let history = JSON.parse(localStorage.getItem('myFiles') || '[]');

// Оновлення інтерфейсу історії
function updateHistoryUI() {
    const container = $('#history');
    container.empty();
    
    if (history.length === 0) {
        container.append('<p style="font-size:12px; color:#666; text-align:center;">No recent uploads</p>');
        return;
    }

    history.forEach(f => {
        container.append(`
            <div class="history-item">
                <div style="display:flex; flex-direction:column;">
                    <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.name}</span>
                    <strong>${f.pin}</strong>
                </div>
                <button onclick="removeFromHistory('${f.pin}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:18px; padding:0 5px;">&times;</button>
            </div>
        `);
    });
}

// Видалення конкретного запису з історії (тільки в браузері)
window.removeFromHistory = function(pin) {
    history = history.filter(f => f.pin != pin);
    localStorage.setItem('myFiles', JSON.stringify(history));
    updateHistoryUI();
};

// Завантаження файлу
$('#uploadBtn').click(function () {
    const fileInput = document.getElementById('file');
    if (!fileInput.files.length) return alert('Choose file');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const btn = $(this);
    btn.prop('disabled', true).text('Uploading...');

    axios.post('/upload', formData)
        .then(res => {
            const pin = res.data.pincode;
            $('#pin-display').text(pin);
            $('#result-area').show();
            
            // QR Code
            $('#qrcode').empty();
            new QRCode(document.getElementById("qrcode"), {
                text: window.location.origin + "/download/" + pin,
                width: 128,
                height: 128
            });

            // Додаємо в історію
            history.unshift({ name: fileInput.files[0].name, pin: pin });
            if(history.length > 5) history.pop();
            localStorage.setItem('myFiles', JSON.stringify(history));
            
            updateHistoryUI();
            loadStats();
        })
        .catch(err => {
            alert('Upload failed!');
            console.error(err);
        })
        .finally(() => {
            btn.prop('disabled', false).text('Upload');
        });
});

// Скачування за ПІНом
$('#downloadBtn').click(function () {
    const pin = $('#pin').val();
    if (pin) window.location.href = `/download/${pin}`;
    else alert('Enter PIN');
});

// Статистика
function loadStats() {
    axios.get('/stats').then(res => $('#totalFiles').text('Files online: ' + res.data.totalFiles));
}

// Початкова ініціалізація
loadStats();
updateHistoryUI();