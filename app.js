require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Cloudinary Config ---
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});



const storageCloud = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'fex_uploads', resource_type: 'auto' },
});
const uploadCloud = multer({ storage: storageCloud });

// --- Local Storage Config ---
const localUploadsDir = path.join(__dirname, 'local_uploads');
if (!fs.existsSync(localUploadsDir)) fs.mkdirSync(localUploadsDir);

const storageLocal = multer.diskStorage({
  destination: (req, file, cb) => cb(null, localUploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});
const uploadLocal = multer({ storage: storageLocal });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
function adminAuth(req, res, next) {
  if (req.headers['x-admin'] !== ADMIN_PASSWORD) {
    return res.sendStatus(403);
  }
  next();
}

app.get('/', (req, res) => res.redirect('/home'));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin-panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- Оновлена Схема ---
const FileSchema = new mongoose.Schema({
  name: String,
  cloudinary_id: String,
  local_path: String,
  isLocal: { type: Boolean, default: false },
  url: String,
  pincode: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date } // Якщо null - файл вічний
});
const File = mongoose.model('File', FileSchema);

// --- Очистка (Перевіряємо кожну хвилину) ---
setInterval(async () => {
  const now = new Date();
  const expiredFiles = await File.find({ expiresAt: { $ne: null, $lt: now } });
  
  for (const file of expiredFiles) {
    if (!file.isLocal && file.cloudinary_id) {
        try {
            await cloudinary.uploader.destroy(file.cloudinary_id);
            console.log(`[Cloud-Delete] Removed: ${file.name}`);
        } catch (e) { console.error(e); }
    } else if (file.isLocal && file.local_path) {
        if (fs.existsSync(file.local_path)) {
            fs.unlinkSync(file.local_path);
            console.log(`[Local-Delete] Removed: ${file.name}`);
        }
    }
    await File.deleteOne({ _id: file._id });
  }
}, 60 * 1000); 

// --- Upload Logic ---
async function handleUpload(req, res, isLocal) {
    if (!req.file) return res.status(400).send('No file uploaded');
    let pin = await generateUniquePin();
    
    // Стандартний час життя - 12 годин
    const defaultExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const fileData = {
        name: req.file.originalname,
        pincode: pin,
        isLocal: isLocal,
        expiresAt: defaultExpiry 
    };

    if (isLocal) {
        fileData.local_path = req.file.path;
    } else {
        fileData.cloudinary_id = req.file.filename;
        fileData.url = req.file.path;
    }

    const file = new File(fileData);
    await file.save();
    res.json({ pincode: pin });
}

app.post('/upload/cloud', uploadCloud.single('file'), (req, res) => handleUpload(req, res, false));
app.post('/upload/local', uploadLocal.single('file'), (req, res) => handleUpload(req, res, true));

async function generateUniquePin() {
    let pin, exists;
    do {
      pin = Math.floor(100000 + Math.random() * 900000);
      exists = await File.findOne({ pincode: pin });
    } while (exists);
    return pin;
}

app.get('/download/:pin', async (req, res) => {
  const file = await File.findOne({ pincode: req.params.pin });
  if (!file) return res.status(404).send('PIN expired or invalid');

  if (file.isLocal) {
      if (fs.existsSync(file.local_path)) {
          res.download(file.local_path, file.name);
      } else {
          await File.deleteOne({ _id: file._id }); 
          res.status(410).send('<h1>File lost (Server restart)</h1>');
      }
  } else {
      const forcedDownloadUrl = file.url.replace('/upload/', '/upload/fl_attachment/');
      res.redirect(forcedDownloadUrl);
  }
});

app.get('/stats', async (req, res) => res.json({ totalFiles: await File.countDocuments() }));

// --- ADMIN ROUTES ---
app.post('/admin/login', (req, res) => {
  if(req.body.password === ADMIN_PASSWORD) res.sendStatus(200);
  else res.sendStatus(401);
});

app.get('/admin/files', adminAuth, async (req, res) => {
  const files = await File.find().sort({ createdAt: -1 });
  const filesData = files.map(f => ({
      id: f._id,
      name: f.name,
      pincode: f.pincode,
      expiresAt: f.expiresAt 
  }));
  res.json(filesData);
});

// --- Оновлений роут у app.js ---
app.put('/admin/files/:id/expiry', async (req, res) => {
    try {
        const { num, unit } = req.body; 
        const file = await File.findById(req.params.id);
        
        if (!file) return res.sendStatus(404);

        if (unit === 'forever') {
            file.expiresAt = null; 
        } else {
            const amount = parseInt(num);
            if (isNaN(amount)) return res.status(400).send("Invalid number");

            let msToAdd = 0;
            if (unit === 'minutes') msToAdd = amount * 60 * 1000;
            else if (unit === 'hours') msToAdd = amount * 60 * 60 * 1000;
            else if (unit === 'days') msToAdd = amount * 24 * 60 * 60 * 1000;

            file.expiresAt = new Date(Date.now() + msToAdd);
        }
        
        await file.save();
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.delete('/admin/files/:id', adminAuth, async (req, res) => {
  const file = await File.findById(req.params.id);
  if (file) {
    if(!file.isLocal && file.cloudinary_id) await cloudinary.uploader.destroy(file.cloudinary_id);
    else if (file.isLocal && fs.existsSync(file.local_path)) fs.unlinkSync(file.local_path);
    await file.deleteOne();
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING (Improved Admin & Logic)`);
    console.log(`🌐 http://localhost:${PORT}/home`);
});