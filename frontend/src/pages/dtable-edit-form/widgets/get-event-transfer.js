const HTML = 'text/html';
const TEXT = 'text/plain';

function getEventTransfer(event) {
  const transfer = event.dataTransfer || event.clipboardData;
  const html = getType(transfer, HTML);
  let text = getType(transfer, TEXT);
  let files = getFiles(transfer);

  /* eslint-disable */
  console.log('-------------------- Copied Data Start -----------------------');
  console.log('html:', html);
  console.log('text:', text);
  console.log('files:', files);
  console.log('-------------------- Copied Data End -------------------------');
  /* eslint-enable */

  // paste html
  if (html) {
    return  {html, text, type: 'html'};
  }

  // paste local picture or other files here
  if (files && files.length) {
    return {'files': files, type: 'files'};
  }
  
  // paste text
  if (text) {
    return {text, type: 'text'};
  }
}

function getType(transfer, type) {
  if (!transfer.types || !transfer.types.length) {
    // COMPAT: In IE 11, there is no `types` field but `getData('Text')`
    // is supported`. (2017/06/23)
    return type === TEXT ? transfer.getData('Text') || null : null;
  }

  return transfer.getData(type);
}

function getFiles(transfer) {
  let files;
  try {
    // Get and normalize files if they exist.
    if (transfer.items && transfer.items.length) {
      files = Array.from(transfer.items)
        .map(item => (item.kind === 'file' ? item.getAsFile() : null))
        .filter(exists => exists);
    } else if (transfer.files && transfer.files.length) {
      files = Array.from(transfer.files);
    }
  } catch (err) {
    if (transfer.files && transfer.files.length) {
      files = Array.from(transfer.files);
    }
  }
  return files;
}

export default getEventTransfer;
