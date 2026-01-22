const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "Xrik_246_"; 


mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:rGwnobufSh9IjtdJ@cluster0.6vpzrpx.mongodb.net/?appName=Cluster0')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use(express.json());


app.get('/', (req, res) => {
    res.redirect('/home');
});


app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------


if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');


const FileSchema = new mongoose.Schema({
  name: String,
  path: String,
  pincode: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now } 
});
const File = mongoose.model('File', FileSchema);


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });


setInterval(async () => {
  const expirationTime = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const expiredFiles = await File.find({ createdAt: { $lt: expirationTime } });
  for (const file of expiredFiles) {
    if (fs.existsSync(file.path)) {
        try {
            fs.unlinkSync(file.path);
            console.log(`File deleted from disk: ${file.name}`);
        } catch (e) {
            console.error(`Error deleting file ${file.name}:`, e);
        }
    }
    await File.deleteOne({ _id: file._id });
    console.log(`Record deleted from DB: ${file.name}`);
  }
}, 5 * 60 * 1000); 


app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  let pin, exists;
  do {
    pin = Math.floor(100000 + Math.random() * 900000);
    exists = await File.findOne({ pincode: pin });
  } while (exists);

  const file = new File({
    name: req.file.originalname,
    path: path.resolve(req.file.path),
    pincode: pin
  });
  await file.save();
  res.json({ pincode: pin });
});


app.get('/download/:pin', async (req, res) => {
  const file = await File.findOne({ pincode: req.params.pin });
  if (!file) return res.status(404).send('PIN expired or invalid');
  if (!fs.existsSync(file.path)) return res.status(410).send('File missing on server');
  res.download(file.path, file.name);
});


app.get('/stats', async (req, res) => {
  const count = await File.countDocuments();
  res.json({ totalFiles: count });
});


app.post('/admin/login', (req, res) => {
    if(req.body.password === ADMIN_PASSWORD) res.sendStatus(200);
    else res.sendStatus(401);
});


app.get('/admin/files', async (req, res) => {
  const files = await File.find().sort({ createdAt: -1 });
  const result = files.map(f => ({
    id: f._id,
    name: f.name,
    pincode: f.pincode,
    expiresInMs: (12 * 60 * 60 * 1000) - (Date.now() - new Date(f.createdAt).getTime())
  }));
  res.json(result);
});


app.delete('/admin/files/:id', async (req, res) => {
  const file = await File.findById(req.params.id);
  if (file) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    await file.deleteOne();
  }
  res.sendStatus(200);
});


app.listen(PORT, () => {
    console.log(`Server started!`);
    console.log(`Main page: http://localhost:${PORT}/home`);
    console.log(`Admin page: http://localhost:${PORT}/admin-panel`);
});