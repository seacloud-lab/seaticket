const { mediaUrl, serviceURL } = window.app.config;

const FILE_EXT_ICON_MAP = {
  // text file
  'md': 'txt.png',
  'txt': 'txt.png',

  // pdf file
  'pdf': 'pdf.png',

  // document file
  'doc': 'word.png',
  'docx': 'word.png',
  'odt': 'word.png',
  'fodt': 'word.png',

  'ppt': 'ppt.png',
  'pptx': 'ppt.png',
  'odp': 'ppt.png',
  'fodp': 'ppt.png',

  'xls': 'excel.png',
  'xlsx': 'excel.png',
  'ods': 'excel.png',
  'fods': 'excel.png',

  // video
  'mp4': 'video.png',
  'ogv': 'video.png',
  'webm': 'video.png',
  'mov': 'video.png',
  'flv': 'video.png',
  'wmv': 'video.png',
  'rmvb': 'video.png',

  // music file
  'mp3': 'music.png',
  'oga': 'music.png',
  'ogg': 'music.png',
  'flac': 'music.png',
  'aac': 'music.png',
  'ac3': 'music.png',
  'wma': 'music.png',

  // image file
  'jpg': 'pic.png',
  'jpeg': 'pic.png',
  'png': 'pic.png',
  'svg': 'pic.png',
  'gif': 'pic.png',
  'bmp': 'pic.png',
  'ico': 'pic.png',

  // folder dir
  'folder': 'folder-192.png',

  // default
  'default': 'file.png'
};

const imageCheck = filename => {
  // no file ext
  if (!filename) return false;
  if (filename.lastIndexOf('.') === -1) {
    return false;
  }
  const file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
  const image_exts = ['gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff', 'webp'];
  return image_exts.includes(file_ext);
};


const getFileIconUrl = (filename, direntType) => {
  let commonUrl = '';
  let file_ext = '';
  if (filename.lastIndexOf('.') === -1) {
    commonUrl = 'img/file/192/' + FILE_EXT_ICON_MAP['default'];
  } else {
    file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
  }

  if (FILE_EXT_ICON_MAP[file_ext]) {
    commonUrl = 'img/file/192/' + FILE_EXT_ICON_MAP[file_ext];
  } else if (direntType === 'dir') {
    commonUrl = 'img/' + FILE_EXT_ICON_MAP['folder'];
  } else {
    commonUrl = 'img/file/192/' + FILE_EXT_ICON_MAP['default'];
  }

  const url = mediaUrl + commonUrl;
  return url;
};

const getImageThumbnailUrl = (url) => {
  let isInternalLink = url.indexOf(serviceURL) > -1;
  if (checkSVGImage(url) || !isInternalLink) {
    return url;
  }
  return url.replace('/workspace', '/thumbnail/workspace') + '?size=256';
};

const checkSVGImage = (url) => {
  if (!url) return false;
  const isSVGImage = url.substr(-4).toLowerCase() === '.svg';
  return isSVGImage;
};

export const getFileThumbnailUrl = (fileItem) => {
  if (!fileItem.name) return FILE_EXT_ICON_MAP['default'];
  let isImage = imageCheck(fileItem.name);
  let seafileFileIndex = fileItem.url.indexOf('seafile-connector');
  let fileIconUrl;
  if (seafileFileIndex > -1) {
    fileIconUrl = getFileIconUrl(fileItem.name, fileItem.type);
  } else if (isImage) {
    fileIconUrl = getImageThumbnailUrl(fileItem.url);
  } else {
    fileIconUrl = getFileIconUrl(fileItem.name, fileItem.type);
  }
  return fileIconUrl;
};
