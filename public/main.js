$('#uploadBtn').click(function () {
    const fileInput = document.getElementById('file');

    if (!fileInput.files.length) {
        alert('Choose a file');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    axios.post('/upload', formData)
        .then(res => {
            $('#result').text('Your PIN code: ' + res.data.pincode);
            loadStats();
        })
        .catch(err => console.error(err));
});

$('#downloadBtn').click(function () {
    const pin = $('#pin').val();
    if (!pin) return alert('Enter PIN');
    window.location.href = `/download/${pin}`;
});

function loadStats() {
    axios.get('/stats')
        .then(res => {
            $('#totalFiles').text('Total files: ' + res.data.totalFiles);
        });
}


loadStats();


