const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3000;



mongoose.connect(
  process.env.MONGO_URI || 
  'mongodb+srv://admin:rGwnobufSh9IjtdJ@cluster0.6vpzrpx.mongodb.net/?appName=Cluster0'
)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });


const FileSchema = new mongoose.Schema({
  name: String,
  path: String,
  pincode: {
    type: Number,
    unique: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', FileSchema);



async function generateUniquePincode() {
  let pin;
  let exists;

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
    path: req.file.path,
    pincode: pin
  });

  await file.save();

  res.json({
    message: 'File uploaded',
    pincode: pin
  });
});

app.get('/download/:pin', async (req, res) => {
  const file = await File.findOne({ pincode: req.params.pin });

  if (!file) return res.status(404).send('File not found');

  res.download(file.path, file.name);
});

app.get('/stats', async (req, res) => {
  const totalFiles = await File.countDocuments();
  res.json({ totalFiles });
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
