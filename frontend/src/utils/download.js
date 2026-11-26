export const downloadFile = (downloadUrl, fileName) => {
  const downloadFrame = document.getElementById('seaqa-download-iframe');
  if (downloadFrame != null) {
    document.body.removeChild(downloadFrame);
  }
  let url = downloadUrl;
  if (fileName) {
    try {
      const downloadUrlObject = new URL(downloadUrl, window.location.href);
      downloadUrlObject.searchParams.set('download', '1');
      downloadUrlObject.searchParams.set('filename', fileName);
      url = downloadUrlObject.toString();
    } catch (error) {
      url = downloadUrl;
    }
  }
  let iframe = document.createElement('iframe');
  iframe.setAttribute('id', 'seaqa-download-iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
};

export const downloadBlobByA = (blob, fileName, callback) => {
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = fileName || 'sea-ticket-markdown.md';
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  setTimeout(() => {
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
  }, 100);
  callback && callback();
};

export const downloadContentByA = (content, fileName, callback) => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlobByA(blob, fileName, callback);
};

export const getFileExtension = (fileName) => {
  return fileName.match(/\.([^.]+)$/)?.[1] || '';
};
