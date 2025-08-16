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
