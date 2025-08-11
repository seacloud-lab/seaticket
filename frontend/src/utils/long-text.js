import { LONG_TEXT_LENGTH_LIMIT } from '../constants';


export const isLongTextValueExceedLimit = (value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.length >= LONG_TEXT_LENGTH_LIMIT;
  const { text } = value || {};
  return text ? text.length >= LONG_TEXT_LENGTH_LIMIT : false;
};

export const getLongTextValueByNew = (longtext, images) => {
  let validLongText = { ...longtext };
  let _images = longtext.images?.slice(0) || [];
  images.forEach(image => {
    let url = new URL(image);
    url = image.replace(url.search, '');
    if (!_images.includes(image) && longtext.text.includes(url)) {
      _images.push(image);
    }
  });
  validLongText.images = _images;
  return validLongText;
};

class LongTextEditorUtilities {

  constructor({ projectUuid, server, api }) {
    this.projectUuid = projectUuid;
    this.server = server;
    this.api = api;
  }

  getImageNameWithTimestamp = (file) => {
    var d = Date.now();
    return 'image-' + d.toString() + file.name.slice(file.name.lastIndexOf('.'));
  };

  uploadLocalImage = (file) => {
    const newFile = new File([file], this.getImageNameWithTimestamp(file), { type: file.type });
    return this.api.uploadFile(this.projectUuid, newFile).then((res) => {
      return this._getImageURL(res.data.url);
    });
  };

  isInternalDirLink = (url) => {
    var re = new RegExp(`${this.server}/#[a-z-]*?/lib/[0-9a-f-]{36}.*`);
    return re.test(url);
  };

  isInternalFileLink = (url) => {
    var re = new RegExp(`${this.server}/lib/[0-9a-f-]{36}/file.*`);
    return re.test(url);
  };

  _getImageURL = (url) => {
    if (!url) return '';
    if (url.startsWith('data:image')) return url;
    return url;
  };

}

export default LongTextEditorUtilities;
