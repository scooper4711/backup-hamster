function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.onload = function () {
            if (this.status === 200) {
                const blob = new Blob([this.response], { type: 'application/octet-stream' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                resolve();
            } else {
                reject(new Error('Failed to download file: ' + this.statusText));
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network error occurred while downloading file.'));
        };

        xhr.send();
    });
}

function downloadFiles(fileList) {
    const downloadPromises = fileList.map(file => downloadFile(file.url, file.name));
    return Promise.all(downloadPromises);
}