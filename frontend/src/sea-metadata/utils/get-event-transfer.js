import { TRANSFER_TYPES } from '../constants';

const { FRAGMENT, HTML, TEXT } = TRANSFER_TYPES;

function getEventTransfer(event) {
  const transfer = event.dataTransfer || event.clipboardData;
  let seaMetadataFragment = getType(transfer, FRAGMENT);
  let html = getType(transfer, HTML);
  let text = getType(transfer, TEXT);
  let files = getFiles(transfer);

  // paste sea-metadata
  if (seaMetadataFragment) {
    return { [TRANSFER_TYPES.METADATA_FRAGMENT]: JSON.parse(seaMetadataFragment), type: TRANSFER_TYPES.METADATA_FRAGMENT };
  }

  // paste html
  if (html) {
    let copiedTableNode = (new DOMParser()).parseFromString(html, HTML).querySelector('table');
    if (copiedTableNode) {
      return { [TRANSFER_TYPES.METADATA_FRAGMENT]: html2TableFragment(copiedTableNode), html, text, type: 'html' };
    }
    return { [TRANSFER_TYPES.METADATA_FRAGMENT]: text2TableFragment(text), html, text, type: 'html' };
  }

  // paste local picture or other files here
  if (files && files.length) {
    return { [TRANSFER_TYPES.METADATA_FRAGMENT]: text2TableFragment(text), 'files': files, type: 'files' };
  }

  // paste text
  if (text) {
    return { [TRANSFER_TYPES.METADATA_FRAGMENT]: text2TableFragment(text), text, type: 'text' };
  }
}

function getType(transfer, type) {
  if (!transfer.types || !transfer.types.length) {
    // COMPAT: In IE 11, there is no `types` column but `getData('Text')`
    // is supported`. (2017/06/23)
    return type === TEXT ? transfer.getData('Text') || null : null;
  }

  return transfer.getData(type);
}

function text2TableFragment(data) {
  let formattedData = data ? data.replace(/\r/g, '') : '';
  let dataSplitted = formattedData.split('\n');
  let rowSplitted = dataSplitted[0].split('\t');
  let copiedColumns = rowSplitted.map((value, j) => ({ key: `col${j}`, type: 'text' }));
  let copiedRows = [];
  dataSplitted.forEach((row) => {
    let obj = {};
    if (row) {
      row = row.split('\t');
      row.forEach((col, j) => {
        obj[`col${j}`] = col;
      });
    }
    copiedRows.push(obj);
  });

  return { copiedRows, copiedColumns };
}

function html2TableFragment(tableNode) {
  let trs = tableNode.querySelectorAll('tr');
  let tds = trs[0].querySelectorAll('td');
  let copiedColumns = [];
  let copiedRows = [];
  tds.forEach((td, i) => {
    copiedColumns.push({ key: `col${i}`, type: 'text' });
  });
  trs.forEach((tr) => {
    let row = {};
    let cells = tr.querySelectorAll('td');
    cells.forEach((cell, i) => {
      row[`col${i}`] = cell.innerText;
    });
    copiedRows.push(row);
  });
  return { copiedRows, copiedColumns };
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

export { text2TableFragment };

export default getEventTransfer;
