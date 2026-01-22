const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;


mongoose.connect(
  process.env.MONGO_URI ||
  'mongodb+srv://admin:rGwnobufSh9IjtdJ@cluster0.6vpzrpx.mongodb.net/?appName=Cluster0'
)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));


setInterval(async () => {
  try {
    await mongoose.connection.db.admin().ping();
  } catch {}
}, 5 * 60 * 1000);


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });


const FileSchema = new mongoose.Schema({
  name: String,
  path: String,
  pincode: { type: Number, unique: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 12 // ⏳ 12 HOURS
  }
});

const File = mongoose.model('File', FileSchema);


async function generateUniquePincode() {
  let pin, exists;
  do {
    pin = Math.floor(100000 + Math.random() * 900000);
    exists = await File.findOne({ pincode: pin });
  } while (exists);
  return pin;
}



app.post('/upload', upload.single('file'), async (req, res) => {
  const pin = await generateUniquePincode();

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
  if (!file) return res.status(404).send('PIN expired');

  if (!fs.existsSync(file.path)) {
    return res.status(410).send('File missing');
  }

  res.download(file.path, file.name);
});



app.get('/admin/files', async (req, res) => {
  const files = await File.find().sort({ createdAt: -1 });

  const now = Date.now();

  const result = files.map(f => ({
    id: f._id,
    name: f.name,
    pincode: f.pincode,
    expiresInMs:
      12 * 60 * 60 * 1000 - (now - new Date(f.createdAt).getTime())
  }));

  res.json(result);
});

app.delete('/admin/files/:id', async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.sendStatus(404);

  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  await file.deleteOne();
  res.sendStatus(200);
});


app.get('/stats', async (req, res) => {
  const count = await File.countDocuments();
  res.json({ totalFiles: count });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
