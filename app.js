const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs'); // Додаємо модуль файлової системи
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "Xrik_246_"; 

// --- 1. Cloudinary Config (Для Фото/Відео) ---
cloudinary.config({
  cloud_name: 'dryiqneae', 
  api_key: '232114764729271',
  api_secret: 'Q0altd8yH8zTa-ZG9Zt0-HTtlJ4'
});

const storageCloud = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fex_uploads',
    resource_type: 'auto', 
  },
});
const uploadCloud = multer({ storage: storageCloud });

// --- 2. Local Storage Config (Для ZIP/RAR) ---
// Створюємо папку, якщо її немає (хоча на Render вона буде створюватися при кожному запуску)
const localUploadsDir = path.join(__dirname, 'local_uploads');
if (!fs.existsSync(localUploadsDir)){
    fs.mkdirSync(localUploadsDir);
}

const storageLocal = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, localUploadsDir)
  },
  filename: function (req, file, cb) {
    // Унікальне ім'я файлу
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});
const uploadLocal = multer({ storage: storageLocal });


mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:rGwnobufSh9IjtdJ@cluster0.6vpzrpx.mongodb.net/?appName=Cluster0')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use(express.json());

app.get('/', (req, res) => res.redirect('/home'));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin-panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public')));

// Оновлена схема: додали поле isLocal, щоб знати, де шукати файл
const FileSchema = new mongoose.Schema({
  name: String,
  cloudinary_id: String, // Для Cloudinary
  local_path: String,    // Для локальних файлів
  isLocal: { type: Boolean, default: false },
  url: String,           // URL для Cloudinary або шлях для локального
  pincode: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now } 
});
const File = mongoose.model('File', FileSchema);

// --- Очистка старих файлів (Тільки Cloudinary) ---
setInterval(async () => {
  const expirationTime = new Date(Date.now() - 12 * 60 * 60 * 1000);
  
  // Шукаємо старі файли (і локальні, і хмарні)
  const expiredFiles = await File.find({ createdAt: { $lt: expirationTime } });
  
  for (const file of expiredFiles) {
    if (!file.isLocal && file.cloudinary_id) {
        // Якщо це Cloudinary - видаляємо з хмари
        try {
            await cloudinary.uploader.destroy(file.cloudinary_id);
            console.log(`[Cloud-Delete] Removed: ${file.name}`);
        } catch (e) { console.error(e); }
    } else if (file.isLocal && file.local_path) {
        // Якщо це локальний файл - пробуємо видалити з диска (якщо сервер ще не перезавантажився)
        if (fs.existsSync(file.local_path)) {
            fs.unlinkSync(file.local_path);
            console.log(`[Local-Delete] Removed: ${file.name}`);
        }
    }
    // Видаляємо запис з БД
    await File.deleteOne({ _id: file._id });
  }
}, 10 * 60 * 1000);


// --- Маршрут 1: Завантаження в ХМАРУ (Фото/Відео) ---
app.post('/upload/cloud', uploadCloud.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  
  let pin = await generateUniquePin();

  const file = new File({
    name: req.file.originalname,
    cloudinary_id: req.file.filename,
    url: req.file.path,
    isLocal: false,
    pincode: pin
  });
  await file.save();
  res.json({ pincode: pin });
});

// --- Маршрут 2: Завантаження ЛОКАЛЬНО (Архіви ZIP/RAR) ---
app.post('/upload/local', uploadLocal.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded');

    let pin = await generateUniquePin();

    const file = new File({
      name: req.file.originalname,
      local_path: req.file.path, // Зберігаємо шлях на сервері
      isLocal: true,
      pincode: pin
    });
    await file.save();
    res.json({ pincode: pin });
});

// Допоміжна функція для PIN
async function generateUniquePin() {
    let pin, exists;
    do {
      pin = Math.floor(100000 + Math.random() * 900000);
      exists = await File.findOne({ pincode: pin });
    } while (exists);
    return pin;
}


// --- Завантаження файлу (Download) ---
app.get('/download/:pin', async (req, res) => {
  const file = await File.findOne({ pincode: req.params.pin });
  if (!file) return res.status(404).send('PIN expired or invalid');

  if (file.isLocal) {
      // Логіка для локальних файлів (ZIP/RAR)
      if (fs.existsSync(file.local_path)) {
          // Якщо файл існує на диску - віддаємо його
          res.download(file.local_path, file.name);
      } else {
          // Якщо файл зник (сервер заснув/перезавантажився), видаляємо запис з БД
          await File.deleteOne({ _id: file._id });
          res.status(410).send(`
            <h1>😔 Файл зник</h1>
            <p>Цей архів був тимчасовим. Сервер перезавантажився ("заснув"), і файл було видалено.</p>
            <a href="/">На головну</a>
          `);
      }
  } else {
      // Логіка для Cloudinary (як було раніше)
      const forcedDownloadUrl = file.url.replace('/upload/', '/upload/fl_attachment/');
      res.redirect(forcedDownloadUrl);
  }
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
    // Якщо файл локальний, але його вже немає фізично - пишемо "Lost", інакше рахуємо час
    expiresInMs: (12 * 60 * 60 * 1000) - (Date.now() - new Date(f.createdAt).getTime())
  })));
});

app.delete('/admin/files/:id', async (req, res) => {
  const file = await File.findById(req.params.id);
  if (file) {
    if(!file.isLocal && file.cloudinary_id) {
        await cloudinary.uploader.destroy(file.cloudinary_id);
    } else if (file.isLocal && file.local_path && fs.existsSync(file.local_path)) {
        fs.unlinkSync(file.local_path);
    }
    await file.deleteOne();
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`✅ SERVER RUNNING: Hybrid Mode (Cloud + Local)`);
    console.log(`🌐 http://localhost:${PORT}/home`);
});