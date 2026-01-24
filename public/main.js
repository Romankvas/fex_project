let history = JSON.parse(localStorage.getItem('myFiles') || '[]');

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

window.removeFromHistory = function(pin) {
    history = history.filter(f => f.pin != pin);
    localStorage.setItem('myFiles', JSON.stringify(history));
    updateHistoryUI();
};

$('#uploadBtn').click(function () {
    const fileInput = document.getElementById('file');
    if (!fileInput.files.length) return alert('Choose file');

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const btn = $(this);
    btn.prop('disabled', true).text('Uploading...');

    // --- ЛОГІКА РОЗПОДІЛУ (НОВА) ---
    const fileName = file.name.toLowerCase();
    // Список розширень, які мають зникати при сні сервера (локальні)
    const isArchive = fileName.endsWith('.zip') || 
                      fileName.endsWith('.rar') || 
                      fileName.endsWith('.7z') || 
                      fileName.endsWith('.tar') ||
                      fileName.endsWith('.gz');

    // Якщо архів -> upload/local, якщо фото/відео -> upload/cloud
    const uploadUrl = isArchive ? '/upload/local' : '/upload/cloud';
    console.log(`Uploading ${fileName} to: ${uploadUrl}`);
    // ---------------------------------

    axios.post(uploadUrl, formData)
        .then(res => {
            const pin = res.data.pincode;
            $('#pin-display').text(pin);
            $('#result-area').show();
            
            $('#qrcode').empty();
            new QRCode(document.getElementById("qrcode"), {
                text: window.location.origin + "/download/" + pin,
                width: 128,
                height: 128
            });

            history.unshift({ name: file.name, pin: pin });
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
            // Очищуємо інпут, щоб можна було завантажити ще раз той самий файл якщо треба
            fileInput.value = ''; 
        });
});

$('#downloadBtn').click(function () {
    const pin = $('#pin').val();
    if (pin) window.location.href = `/download/${pin}`;
    else alert('Enter PIN');
});

function loadStats() {
    axios.get('/stats')
        .then(res => $('#totalFiles').text('Files online: ' + res.data.totalFiles))
        .catch(console.error);
}

// Ініціалізація при завантаженні
loadStats();
updateHistoryUI();