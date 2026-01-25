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
        const res = await axios.get('/admin/files');
        allFiles = res.data;
        renderFiles();
    } catch (err) { console.error(err); }
}

function filterTab(tab, event) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active');
    renderFiles();
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
        grid.innerHTML = `<div class="no-files"><p>Файлів не знайдено.</p></div>`;
        return;
    }

    filtered.forEach(f => {
        let timeDisplayHtml = '';
        if (!f.expiresAt) {
            timeDisplayHtml = `<div class="card-timer timer-infinite">∞ Forever</div>`;
        } else {
            const diff = new Date(f.expiresAt) - new Date();
            if (diff <= 0) {
                timeDisplayHtml = `<div class="card-timer timer-critical">Expired</div>`;
            } else {
                const totalMinutes = Math.floor(diff / 60000);
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                const d = Math.floor(h / 24);

                let timeText = d > 0 ? `${d}d ${h % 24}h` : (h > 0 ? `${h}h ${m}m` : `${m}m`);
                timeDisplayHtml = `<div class="card-timer timer-normal">⏳ ${timeText}</div>`;
            }
        }

        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `
            <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <span class="file-name" title="${f.name}" style="font-size: 14px;">${f.name}</span>
                <span class="file-pin" style="font-size: 15px; color: #00ffcc;">#${f.pincode}</span>
            </div>
            
            ${timeDisplayHtml}
            
            <div class="card-actions" style="display: flex; gap: 8px; align-items: center; margin-top: 5px;">
                <div class="time-control-group" style="display: flex; gap: 4px; flex-grow: 1;">
                    <input type="number" id="num-${f.id}" class="time-input-num" placeholder="12">
                    <select id="unit-${f.id}" class="time-input-select" onchange="checkForever('${f.id}')">
                        <option value="hours">Hrs</option>
                        <option value="days">Days</option>
                        <option value="forever">∞ Inf</option>
                    </select>
                </div>
                <button onclick="updateTime('${f.id}')" style="background: #4CAF50; border-radius: 8px;">OK</button>
                <button class="del-small" onclick="removeFile('${f.id}')" style="background: rgba(255,77,77,0.2); color: #ff4d4d; border: 1px solid #ff4d4d; padding: 5px 10px; border-radius: 8px;">🗑</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Якщо вибрали "Forever", блокуємо поле цифр, щоб не плутати
function checkForever(id) {
    const unit = document.getElementById(`unit-${id}`).value;
    const numInput = document.getElementById(`num-${id}`);
    if (unit === 'forever') {
        numInput.disabled = true;
        numInput.value = '';
        numInput.placeholder = '∞';
    } else {
        numInput.disabled = false;
        if(numInput.value === '') numInput.value = '12';
    }
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
        return;
    }

    filtered.forEach(f => {
        let timeDisplayHtml = '';
        
        if (!f.expiresAt) {
            // Ефект Forever з іконкою
            timeDisplayHtml = `<div class="card-timer timer-infinite">∞ Forever</div>`;
        } else {
            const diff = new Date(f.expiresAt) - new Date();
            if (diff <= 0) {
                timeDisplayHtml = `<div class="card-timer timer-critical">Expired</div>`;
            } else {
                const totalMinutes = Math.floor(diff / 60000);
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                const d = Math.floor(h / 24);

                let timeText = "";
                if (d > 0) timeText = `${d}d ${h % 24}h`;
                else if (h > 0) timeText = `${h}h ${m}m`;
                else timeText = `${m}m`;

                timeDisplayHtml = `<div class="card-timer timer-normal">⏳ ${timeText}</div>`;
            }
        }

        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `
            <div class="card-header" style="flex-direction: column; align-items: flex-start;">
                <span class="file-name" title="${f.name}">${f.name}</span>
                <span class="file-pin" style="font-size: 14px;">#${f.pincode}</span>
            </div>
            
            ${timeDisplayHtml}
            
            <div class="time-control-group">
                <input type="number" id="num-${f.id}" class="time-input-num" placeholder="12">
                <select id="unit-${f.id}" class="time-input-select" onchange="checkForever('${f.id}')">
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
}
async function updateTime(id) {
    const num = document.getElementById(`num-${id}`).value;
    const unit = document.getElementById(`unit-${id}`).value;
    
    // Перевірка на дурня
    if (unit !== 'forever' && !num) return alert("Enter a number!");

    if(!confirm("Змінити час?")) return;
    
    await axios.put(`/admin/files/${id}/expiry`, { num, unit });
    loadFiles();
}

async function removeFile(id) {
    if(!confirm("Видалити?")) return;
    await axios.delete('/admin/files/' + id);
    loadFiles();
}

function logout() {
    localStorage.removeItem('adminPass');
    location.reload();
}

window.onload = () => {
    checkLogin();
    const savedTheme = localStorage.getItem('siteTheme');
    if(savedTheme) setTheme(savedTheme);
};