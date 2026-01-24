let password = localStorage.getItem('adminPass');

async function checkLogin() {
    if (!password) {
        password = prompt("Введіть пароль адміністратора:");
    }

    if (!password) {
        document.body.innerHTML = '<div style="color:white;text-align:center;padding-top:50px;"><h1>🔐 Вхід скасовано</h1><button onclick="location.reload()">Спробувати знову</button></div>';
        return;
    }

    try {
        await axios.post('/admin/login', { password });
        localStorage.setItem('adminPass', password);
        loadFiles();
    } catch (e) {
        alert("❌ Невірний пароль!");
        localStorage.removeItem('adminPass');
        password = null;
        location.reload();
    }
}

async function loadFiles() {
    try {
        const res = await axios.get('/admin/files');
        const tbody = document.getElementById('files');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        res.data.forEach(f => {
            const tr = document.createElement('tr');
            const minutesLeft = Math.max(0, Math.floor(f.expiresInMs / 60000));
            tr.innerHTML = `
                <td>${f.name}</td>
                <td><strong style="color:#00ffcc;">${f.pincode}</strong></td>
                <td class="timer">${minutesLeft}m left</td>
                <td><button onclick="removeFile('${f.id}')" class="delete-btn">❌</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Load error", err);
    }
}

async function removeFile(id) {
    if(!confirm('Видалити файл?')) return;
    await axios.delete('/admin/files/' + id);
    loadFiles();
}

window.onload = checkLogin;
setInterval(() => { if(localStorage.getItem('adminPass')) loadFiles(); }, 60000);