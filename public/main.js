let history = JSON.parse(localStorage.getItem('myFiles') || '[]');

function updateHistoryUI() {
    const container = $('#history');
    // Пошук в історії (знаходить елемент по ID з index.html)
    const searchInput = document.getElementById('history-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    
    container.empty();
    
    if (history.length === 0) {
        container.append('<p style="font-size:12px; color:#666; text-align:center;">No recent uploads</p>');
        return;
    }

    // Фільтруємо за пошуковим запитом
    const filtered = history.filter(f => f.name.toLowerCase().includes(query));

    if (filtered.length === 0 && history.length > 0) {
         container.append('<p style="font-size:12px; color:#666; text-align:center;">Not found</p>');
         return;
    }

    filtered.forEach(f => {
        container.append(`
            <div class="history-item">
                <div style="display:flex; flex-direction:column;">
                    <span style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${f.name}">${f.name}</span>
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
    if (!fileInput.files.length) return alert('Please select a file first!');

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const btn = $(this);
    btn.prop('disabled', true).html('<span class="loader"></span> Uploading...');

    const fileName = file.name.toLowerCase();
    const isArchive = fileName.endsWith('.zip') || 
                      fileName.endsWith('.rar') || 
                      fileName.endsWith('.7z') || 
                      fileName.endsWith('.tar') ||
                      fileName.endsWith('.gz');

    const uploadUrl = isArchive ? '/upload/local' : '/upload/cloud';

    axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then(res => {
        const pin = res.data.pincode;
        
        $('#pin-display').text(pin);
        $('#result-area').fadeIn();
        
        $('#qrcode').empty();
        new QRCode(document.getElementById("qrcode"), {
            text: window.location.origin + "/download/" + pin,
            width: 128,
            height: 128,
            colorDark : "#1c1c2b",
            colorLight : "#ffffff"
        });

        // Додаємо в історію
        history.unshift({ name: file.name, pin: pin });
        if(history.length > 5) history.pop();
        localStorage.setItem('myFiles', JSON.stringify(history));
        
        updateHistoryUI();
        loadStats();
        
        fileInput.value = '';
    })
    .catch(err => {
        console.error("Upload Error Details:", err);
        alert('Upload failed! Check console for details.');
    })
    .finally(() => {
        btn.prop('disabled', false).text('Upload');
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
        .catch(err => console.log("Stats error", err));
}

// Запуск при старті
$(document).ready(function() {
    loadStats();
    updateHistoryUI();
});