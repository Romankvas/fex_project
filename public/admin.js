// Функція форматування мілісекунд у години:хвилини:секунди
function format(ms) {
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

async function loadFiles() {
  try {
    const res = await axios.get('/admin/files');
    const tbody = document.getElementById('files');
    tbody.innerHTML = '';

    res.data.forEach(f => {
      const tr = document.createElement('tr');
      // Додаємо data-ms для таймера
      tr.innerHTML = `
        <td>${f.name}</td>
        <td><strong>${f.pincode}</strong></td>
        <td data-ms="${f.expiresInMs}" class="timer">${format(f.expiresInMs)}</td>
        <td>
          <a href="/download/${f.pincode}" target="_blank">⬇</a>
          <button onclick="removeFile('${f.id}')" style="background:#ff4d4d;">❌</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading files:", err);
  }
}

async function removeFile(id) {
  if(!confirm('Видалити файл?')) return;
  try {
    await axios.delete('/admin/files/' + id);
    loadFiles(); // Перезавантажити список
  } catch (err) {
    alert('Помилка видалення');
  }
}

// Таймер: оновлюється щосекунди
setInterval(() => {
  document.querySelectorAll('[data-ms]').forEach(el => {
    let ms = Number(el.dataset.ms);
    
    if (ms > 0) {
        ms -= 1000; // Віднімаємо 1 секунду
        el.dataset.ms = ms;
        el.innerText = format(ms);
    } else {
        el.innerText = 'expired';
    }
  });
}, 1000);

// Запуск при завантаженні сторінки
loadFiles();