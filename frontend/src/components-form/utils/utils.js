import { CellType, isValidEmail, DateUtils, formatStringToNumber, formatDurationToNumber } from 'dtable-utils';
import { formatStringToRegexp } from '../../utils/utils';
import { FORMAT_REG_EXP_LIST } from '../../pages/dtable-edit-form/widgets/CheckFormatRegExp';

// [FIX] work weixin chrome 53 not support String.padEnd
// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
if (!String.prototype.padEnd) {
  // eslint-disable-next-line no-extend-native
  String.prototype.padEnd = function padEnd(targetLength, padString) {
    targetLength = targetLength >> 0; // floor if number or convert non-number to 0;
    padString = String((typeof padString !== 'undefined' ? padString : ''));
    if (this.length > targetLength) {
      return String(this);
    }
    else {
      targetLength = targetLength - this.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length); // append to original to ensure we are longer than needed
      }
      return String(this) + padString.slice(0, targetLength);
    }
  };
}

/** file icon utils */

const FILEEXT_ICON_MAP = {
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

export const getFileIconUrl = (mediaUrl, filename, direntType) => {
  let commonUrl = '';
  let file_ext = '';
  if (filename.lastIndexOf('.') === -1) {
    commonUrl = 'img/file/192/' + FILEEXT_ICON_MAP['default'];
  } else {
    file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
  }

  if (FILEEXT_ICON_MAP[file_ext]) {
    commonUrl = 'img/file/192/' + FILEEXT_ICON_MAP[file_ext];
  } else if (direntType === 'dir') {
    commonUrl = 'img/' + FILEEXT_ICON_MAP['folder'];
  } else {
    commonUrl = 'img/file/192/' + FILEEXT_ICON_MAP['default'];
  }

  let url = mediaUrl + commonUrl;
  return url;
};

/** date utils */
export const formatDateValue = (value, format) => {
  return DateUtils.format(value, format);
};

/** checkbox utils */
export const getInvalidCheckboxColumns = (columns, rowData = {}) => {
  return columns.filter(column => {
    const { key, type, require_fill_checked } = column;
    if (type !== CellType.CHECKBOX) return false;
    const colValue = rowData[key];
    if (require_fill_checked) return !colValue;
    return false;
  });
};

/** email utils */
export const getInvalidEmailColumns = (columns, rowData = {}) => {
  return columns.filter(column => {
    let { key, type } = column;
    if (type !== CellType.EMAIL) return false;
    let colValue = rowData[key];
    return colValue && !isValidEmail(colValue);
  });
};

export const getInvalidTextRegColumns = (columns, rowData = {}) => {
  return columns.filter(column => {
    let { key, type, data } = column;
    const { format_specification_value, enable_check_format, format_check_type } = data || {};
    if (type !== CellType.TEXT) return false;
    let colValue = rowData[key];
    if (enable_check_format) {
      if (format_check_type === 'custom_format') {
        const reg = formatStringToRegexp(format_specification_value);
        return colValue && reg && !reg.test(colValue);
      } else {
        const reg = FORMAT_REG_EXP_LIST[format_check_type];
        return colValue && !reg.test(colValue);
      }
    }
    return false;
  });
};

export const getInvalidNumberColumns = (columns, rowData = {}) => {
  return columns.filter(column => {
    let { key, type, data } = column;
    const { enable_check_format, format_min_value, format_max_value } = data || {};
    if (type !== CellType.NUMBER) return false;
    let colValue = rowData[key];
    if (enable_check_format) {
      return colValue < format_min_value || colValue > format_max_value;
    }
    return false;
  });
};

export const convertRowDataBack = (columns, rowData = {}) => {
  let result = {};
  if (Object.keys(rowData).length > 0) {
    Object.keys(rowData).forEach((key) => {
      const column = columns.find(column => column.key === key);
      if (!column) return;
      const { type, data } = column;
      const value = rowData[key];
      result[key] = value;
      if (type === CellType.NUMBER && typeof value === 'string') {
        result[key] = value ? formatStringToNumber(value, data) : '';
      } else if (type === CellType.DURATION) {
        result[key] = value ? formatDurationToNumber(value, data) : '';
      }
    });
  }
  return result;
};

/* is weiXin built-in browser */
export const isWeiXinBuiltInBrowser = () => {
  let agent = navigator.userAgent.toLowerCase();
  if (agent.match(/MicroMessenger/i) === 'micromessenger' ||
    (typeof window.WeixinJSBridge !== 'undefined')) {
    return true;
  }
  return false;
};

export const isDingTalkBuiltInBrowser = () => {
  const ua = window.navigator.userAgent;
  return ua.indexOf('DingTalk') !== -1; // true or false
};

export const imageNameFilter = (imageName) => {
  const pattern = new RegExp('[`~%!^=\'?~！$@#￥……&——‘”“？*（）{}，,。、]', 'g');
  return imageName.replace(pattern, '-');
};

export const isValidPosition = (lng, lat) => {
  return (lng || lng === 0) && (lat || lat === 0);
};

export const isValidUrl = (url) => {
  const reg = /^(([-a-zA-Z0-9+.]+):\/\/)[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/;

  return reg.test(url);
};

const LONG_TEXT_LENGTH_LIMIT = 10 * 10000;

export const isLongTextValueExceedLimit = (value) => {
  const { text } = value;
  return text ? text.length >= LONG_TEXT_LENGTH_LIMIT : false;
};

export const getValidLongTextValue = (value) => {
  const newValue = { ...value };
  const { text } = newValue;
  newValue.text = text.slice(0, LONG_TEXT_LENGTH_LIMIT);
  return newValue;
};
