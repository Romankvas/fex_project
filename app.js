const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "Xrik_246_"; 


cloudinary.config({
  cloud_name: 'dryiqneae', 
  api_key: '232114764729271',
  api_secret: 'Q0altd8yH8zTa-ZG9Zt0-HTtlJ4'
});


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fex_uploads',
    resource_type: 'auto', 
  },
});
const upload = multer({ storage });


mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:rGwnobufSh9IjtdJ@cluster0.6vpzrpx.mongodb.net/?appName=Cluster0')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use(express.json());


app.get('/', (req, res) => res.redirect('/home'));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin-panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public')));


const FileSchema = new mongoose.Schema({
  name: String,
  cloudinary_id: String,
  url: String,
  pincode: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now } 
});
const File = mongoose.model('File', FileSchema);


setInterval(async () => {
  const expirationTime = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const expiredFiles = await File.find({ createdAt: { $lt: expirationTime } });
  
  for (const file of expiredFiles) {

    await cloudinary.uploader.destroy(file.cloudinary_id);

    await File.deleteOne({ _id: file._id });
    console.log(`[Auto-Delete] Removed: ${file.name}`);
  }
}, 10 * 60 * 1000);


app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  
  let pin, exists;
  do {
    pin = Math.floor(100000 + Math.random() * 900000);
    exists = await File.findOne({ pincode: pin });
  } while (exists);

  const file = new File({
    name: req.file.originalname,
    cloudinary_id: req.file.filename,
    url: req.file.path,
    pincode: pin
  });
  await file.save();
  res.json({ pincode: pin });
});


app.get('/download/:pin', async (req, res) => {
  const file = await File.findOne({ pincode: req.params.pin });
  if (!file) return res.status(404).send('PIN expired or invalid');

 
  const forcedDownloadUrl = file.url.replace('/upload/', '/upload/fl_attachment/');
  
  res.redirect(forcedDownloadUrl);
});


app.get('/stats', async (req, res) => {
  res.json({ totalFiles: await File.countDocuments() });
});

app.post('/admin/login', (req, res) => {
  if(req.body.password === ADMIN_PASSWORD) res.sendStatus(200);
  else res.sendStatus(401);
});

app.get('/admin/files', async (req, res) => {
  const files = await File.find().sort({ createdAt: -1 });
  res.json(files.map(f => ({
    id: f._id,
    name: f.name,
    pincode: f.pincode,
    expiresInMs: (12 * 60 * 60 * 1000) - (Date.now() - new Date(f.createdAt).getTime())
  })));
});

app.delete('/admin/files/:id', async (req, res) => {
  const file = await File.findById(req.params.id);
  if (file) {
    await cloudinary.uploader.destroy(file.cloudinary_id);
    await file.deleteOne();
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`\n🚀 ============================================`);
    console.log(`✅ SERVER IS RUNNING WITH CLOUDINARY!`);
    console.log(`🌐 Main Page:   http://localhost:${PORT}/home`);
    console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin-panel`);
    console.log(`============================================\n`);
    console.log(`Press Ctrl+C to stop the server`);
});