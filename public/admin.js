let password = localStorage.getItem('adminPass');

async function checkLogin() {
    if (!password) password = prompt("Enter Admin Password:");
    try {
        await axios.post('/admin/login', { password });
        localStorage.setItem('adminPass', password);
        loadFiles();
    } catch (e) {
        alert("Wrong password");
        localStorage.removeItem('adminPass');
        location.reload();
    }
}

async function loadFiles() {
    try {
        const res = await axios.get('/admin/files');
        const tbody = document.getElementById('files');
        tbody.innerHTML = '';
        res.data.forEach(f => {
            const tr = document.createElement('tr');
            const minutesLeft = Math.max(0, Math.floor(f.expiresInMs / 60000));
            tr.innerHTML = `
                <td>${f.name}</td>
                <td><strong>${f.pincode}</strong></td>
                <td class="timer">${minutesLeft}m left</td>
                <td><button onclick="removeFile('${f.id}')" style="background:#ff4d4d; padding: 5px 10px;">❌</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Load error", err);
    }
}

async function removeFile(id) {
    if(!confirm('Delete this file?')) return;
    await axios.delete('/admin/files/' + id);
    loadFiles();
}

checkLogin();
// Оновлювати список кожну хвилину
setInterval(loadFiles, 60000);