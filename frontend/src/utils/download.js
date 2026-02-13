export const downloadFile = (downloadUrl) => {
  const downloadFrame = document.getElementById('sea-qa-download-iframe');
  if (downloadFrame != null) {
    document.body.removeChild(downloadFrame);
  }
  let iframe = document.createElement('iframe');
  iframe.setAttribute('id', 'sea-qa-download-iframe');
  iframe.style.display = 'none';
  iframe.src = downloadUrl;
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
