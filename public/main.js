let history = JSON.parse(localStorage.getItem('myFiles') || '[]');

function updateHistoryUI() {
    const container = $('#history');
    container.empty(); // Виправлено: використовуємо empty() замість innerHTML на jQuery об'єкті
    history.forEach(f => {
        container.append(`<div class="history-item"><span>${f.name}</span> - <strong>${f.pin}</strong></div>`);
    });
}

$('#uploadBtn').click(function () {
    const fileInput = document.getElementById('file');
    if (!fileInput.files.length) return alert('Choose file');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Вимикаємо кнопку на час завантаження
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

$('#downloadBtn').click(function () {
    const pin = $('#pin').val();
    if (pin) window.location.href = `/download/${pin}`;
    else alert('Enter PIN');
});

function loadStats() {
    axios.get('/stats').then(res => $('#totalFiles').text('Files online: ' + res.data.totalFiles));
}

loadStats();
updateHistoryUI();