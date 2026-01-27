let password = localStorage.getItem('adminPass');
let allFiles = []; 
let currentTab = 'all';

async function checkLogin() {
    if (!password) password = prompt("Введіть пароль:");
    try {
        await axios.post('/admin/login', { password });
        localStorage.setItem('adminPass', password);
        loadFiles();
    } catch (e) {
        localStorage.removeItem('adminPass');
        location.reload();
    }
}

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
    localStorage.setItem('siteTheme', theme);
}

function getFileType(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'other';
}

async function loadFiles() {
    try {
        const res = await axios.get('/admin/files', {
            headers: {
                'x-admin': localStorage.getItem('adminPass')
            }
        });
        allFiles = res.data;
        renderFiles();
    } catch (err) {
        console.error(err);
        alert('Немає доступу до адмінки. Увійди ще раз.');
    }
}


function filterTab(tab, event) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active');
    renderFiles();
}
// Якщо вибрали "Forever", блокуємо поле цифр, щоб не плутати
function checkForever(id) {
    const unitSelect = document.getElementById(`unit-${id}`);
    const numInput = document.getElementById(`num-${id}`);

    if (unitSelect.value === 'forever') {
        numInput.disabled = true;
        numInput.value = '';
        numInput.placeholder = '∞';
    } else {
        numInput.disabled = false;
        numInput.placeholder = '12';
    }
}
function addAdminLog(action) {
    let logs = JSON.parse(localStorage.getItem('adminLogs') || '[]');
    const time = new Date().toLocaleTimeString();
    logs.unshift(`[${time}] ${action}`);
    
    // Тримаємо тільки останні 10 записів
    if (logs.length > 10) logs.pop();
    
    localStorage.setItem('adminLogs', JSON.stringify(logs));
    renderAdminLogs();
}

function renderAdminLogs() {
    const container = document.getElementById('log-container');
    const logs = JSON.parse(localStorage.getItem('adminLogs') || '[]');
    
    if (logs.length === 0) return;
    
    container.innerHTML = logs.map(log => `<div>${log}</div>`).join('');
}
function renderFiles() {
    const grid = document.getElementById('file-grid');
    const searchQuery = document.getElementById('admin-search') ? document.getElementById('admin-search').value.toLowerCase() : '';
    
    grid.innerHTML = '';
    
    const filtered = allFiles.filter(f => {
        const matchesTab = currentTab === 'all' || getFileType(f.name) === currentTab;
        const matchesSearch = f.name.toLowerCase().includes(searchQuery);
        return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-files"><p>No files found.</p></div>`;
        updateSelectedCount(); // Оновити лічильник
        return;
    }

    filtered.forEach(f => {
        let timeDisplayHtml = '';
        const diff = f.expiresAt ? (new Date(f.expiresAt) - new Date()) : null;

        if (!f.expiresAt) {
            timeDisplayHtml = `<div class="card-timer timer-infinite"><span class="status-dot status-active"></span> ∞ Forever</div>`;
        } else if (diff <= 0) {
            timeDisplayHtml = `<div class="card-timer timer-critical"><span class="status-dot status-expired"></span> Expired</div>`;
        } else {
            const totalMinutes = Math.floor(diff / 60000);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            const d = Math.floor(h / 24);
            let timeText = d > 0 ? `${d}d ${h % 24}h` : (h > 0 ? `${h}h ${m}m` : `${m}m`);
            const statusClass = totalMinutes < 60 ? 'status-warning' : 'status-active';
            timeDisplayHtml = `<div class="card-timer timer-normal"><span class="status-dot ${statusClass}"></span> ⏳ ${timeText}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <input type="checkbox" class="file-checkbox" value="${f.id}" onchange="updateSelectedCount()" style="width: 18px; height: 18px; cursor: pointer; margin-top: 5px;">
                <div class="card-header" style="flex-direction: column; align-items: flex-start; flex-grow: 1;">
                    <span class="file-name" title="${f.name}">${f.name}</span>
                    <span class="file-pin" onclick="copyToClipboard('${f.pincode}')" style="font-size: 14px; cursor: pointer;">#${f.pincode} 📋</span>
                </div>
            </div>
            
            ${timeDisplayHtml}
            
            <div class="time-control-group">
                <input type="number" id="num-${f.id}" class="time-input-num" placeholder="12">
                <select id="unit-${f.id}" class="time-input-select" onchange="checkForever('${f.id}')">
                    <option value="minutes">Min</option>
                    <option value="hours">Hrs</option>
                    <option value="days">Days</option>
                    <option value="forever">∞ Inf</option>
                </select>
                <button onclick="updateTime('${f.id}')" style="background: #4CAF50;">OK</button>
            </div>
            
            <button class="del-small" onclick="removeFile('${f.id}')" style="width: 100%; margin-top: 5px; background: rgba(255,77,77,0.2); color: #ff4d4d; border: 1px solid #ff4d4d;">Delete</button>
        `;
        grid.appendChild(card);
    });
    updateSelectedCount();
}
async function updateTime(id) {
    const numInput = document.getElementById(`num-${id}`);
    const unitSelect = document.getElementById(`unit-${id}`);

    const unit = unitSelect.value;
    let num = numInput.value;

    // Захист
    if (unit !== 'forever' && (!num || num <= 0)) {
        return alert("Enter hours or days!");
    }

    if (!confirm("Змінити час життя файлу?")) return;

    // 🔥 КЛЮЧОВЕ:
    // якщо forever — шлемо спец значення
    const payload =
        unit === 'forever'
            ? { unit: 'forever' }
            : { unit, num: Number(num) };

    try {
        await axios.put(`/admin/files/${id}/expiry`, payload);
        loadFiles();
        addAdminLog(`Updated time for file ID: ${id}`); // <--- ДОДАТИ ЦЕ
    } catch (err) {
        console.error(err);
        alert("Error updating time");
    }
}


async function removeFile(id) {
    if (!confirm("Видалити?")) return;

    await axios.delete('/admin/files/' + id, {
        headers: { 'x-admin': localStorage.getItem('adminPass') }
    });

    loadFiles();
    addAdminLog(`Deleted file ID: ${id}`); // <--- ДОДАТИ ЦЕ
}


function logout() {
    localStorage.removeItem('adminPass');
    location.reload();
}
function updateSelectedCount() {
    const checked = document.querySelectorAll('.file-checkbox:checked');
    const btn = document.getElementById('delete-selected-btn');
    const countSpan = document.getElementById('selected-count');
    
    if (checked.length > 0) {
        btn.style.display = 'block';
        countSpan.innerText = checked.length;
    } else {
        btn.style.display = 'none';
    }
}

async function removeSelectedFiles() {
    const checked = document.querySelectorAll('.file-checkbox:checked');
    if (!confirm(`Видалити обрані файли (${checked.length})?`)) return;

    const ids = Array.from(checked).map(cb => cb.value);
    
    // Видаляємо по черзі (або можна переробити бекенд під масив, але поки так)
    for (const id of ids) {
        try {
            await axios.delete('/admin/files/' + id, {
                headers: { 'x-admin': localStorage.getItem('adminPass') }
            });
        } catch (e) { console.error("Error deleting " + id); }
    }
    
  loadFiles();
    addAdminLog(`Mass deleted ${ids.length} files`); // <--- ДОДАТИ ЦЕ
}
/* === ЗАМІНИТИ ВЕСЬ window.onload В НИЗУ admin.js === */
window.onload = () => {
    checkLogin();
    renderAdminLogs();
    
    // Відновлення теми
    const savedTheme = localStorage.getItem('siteTheme');
    if(savedTheme) setTheme(savedTheme);

    // 🕒 АВТО-ОНОВЛЕННЯ: кожні 60 секунд (60000 мс) оновлюємо список
    setInterval(() => {
        if (localStorage.getItem('adminPass')) {
            loadFiles(); // Перезавантажує дані з сервера
        }
    }, 60000);
};
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const x = document.getElementById("toast");
        x.innerText = `PIN #${text} Copied!`;
        x.className = "show";
        setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
    });
}