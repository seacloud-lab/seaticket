import React from 'react';
import toaster from '../components/toaster';
import { mediaUrl, gettext, serviceURL, lang, avatarURL } from '../constants/config';
import { strChineseFirstPY } from './pinyin-by-unicode';
import { NOTIFICATION_TYPE } from '../constants/notification-constants';
import PermissionDeniedTip from '../components/permission-denied-tip';
import { canUseDOM } from './dom-operations';

export const Utils = {

  keyCodes: {
    tab: 9,
    backspace: 8,
    enter: 13,
    shift: 16,
    esc: 27,
    space: 32,
    up: 38,
    down: 40,
  },

  numberKeyCodes: {
    0: 48,
    1: 49,
    2: 50,
    3: 51,
    4: 52,
    5: 53,
    6: 54,
    7: 55,
    8: 56,
    9: 57,
  },

  bytesToSize: function (bytes) {
    if (typeof(bytes) === 'undefined') return ' ';

    if (bytes < 0) return '--';
    const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

    if (bytes === 0) return bytes + ' ' + sizes[0];

    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1000)), 10);
    if (i === 0) return bytes + ' ' + sizes[i];
    return (bytes / (1000 ** i)).toFixed(1) + ' ' + sizes[i];
  },

  isHiDPI: function () {
    var pixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;
    if (pixelRatio > 1) {
      return true;
    } else {
      return false;
    }
  },

  isDesktop: function () {
    return window.innerWidth >= 768;
  },

  isIOS: function () {
    return canUseDOM && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  },

  openPage: function (event, href) {
    if (!event) return;
    event.persist();
    event.stopPropagation();
    event.preventDefault();
    let name = event.metaKey || event.ctrlKey ? '_blank' : '_self';
    window.open(href, name);
  },

  FILEEXT_ICON_MAP: {

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

    // default
    'default': 'file.png'
  },

  // check if a file is an image
  imageCheck: function (filename) {
    // no file ext
    if (filename.lastIndexOf('.') === -1) {
      return false;
    }
    var file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
    var image_exts = ['gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff'];
    if (image_exts.indexOf(file_ext) !== -1) {
      return true;
    } else {
      return false;
    }
  },

  // check if a file is a video
  videoCheck: function (filename) {
    // no file ext
    if (filename.lastIndexOf('.') === -1) {
      return false;
    }
    var file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
    var exts = ['mp4', 'ogv', 'webm', 'mov'];
    if (exts.indexOf(file_ext) !== -1) {
      return true;
    } else {
      return false;
    }
  },

  encodePath: function (path) {
    // IE8 does not support 'map()'
    /*
       return path.split('/').map(function(e) {
       return encodeURIComponent(e);
       }).join('/');
       */
    if (!path) {
      return '';
    }
    var path_arr = path.split('/');
    var path_arr_ = [];
    for (var i = 0, len = path_arr.length; i < len; i++) {
      path_arr_.push(encodeURIComponent(path_arr[i]));
    }
    return path_arr_.join('/');
  },

  HTMLescape: function (html) {
    return document.createElement('div')
      .appendChild(document.createTextNode(html))
      .parentNode
      .innerHTML;
  },

  joinPath: function (pathA, pathB) {
    if (pathA[pathA.length - 1] === '/') {
      return pathA + pathB;
    } else {
      return pathA + '/' + pathB;
    }
  },

  isIEBrower: function () { // is ie <= ie11 not include Edge
    var userAgent = navigator.userAgent;
    var isIE = userAgent.indexOf('compatible') > -1 && userAgent.indexOf('MSIE') > -1;
    var isIE11 = userAgent.indexOf('Trident') > -1 && userAgent.indexOf('rv:11.0') > -1;
    return isIE || isIE11;
  },

  getDTableIconClass: function () {
    return `dtable-font dtable-icon-table system-dtable-font ${Utils.isDesktop() ? 'project-icon-style' : ''}`;
  },

  getDirentIcon: function (dirent, isBig) {
    let size = this.isHiDPI() ? 48 : 24;
    size = isBig ? 192 : size;
    if (dirent.isDir()) {
      let readonly = false;
      if (dirent.permission && (dirent.permission === 'r' || dirent.permission === 'preview')) {
        readonly = true;
      }
      return this.getFolderIconUrl(readonly, size);
    } else {
      return this.getFileIconUrl(dirent.name, size);
    }
  },

  getFolderIconUrl: function (readonly = false, size) {
    if (!size) {
      size = Utils.isHiDPI() ? 48 : 24;
    }
    size = size > 24 ? 192 : 24;
    return `${mediaUrl}img/folder${readonly ? '-read-only-' : '-'}${size}.png`;
  },

  getFileIconUrl: function (filename, size) {
    if (!size) {
      size = Utils.isHiDPI() ? 48 : 24;
    }
    size = size > 24 ? 192 : 24;
    let file_ext = '';
    if (filename.lastIndexOf('.') === -1) {
      return mediaUrl + 'img/file/' + size + '/' + this.FILEEXT_ICON_MAP['default'];
    } else {
      file_ext = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    if (this.FILEEXT_ICON_MAP[file_ext]) {
      return mediaUrl + 'img/file/' + size + '/' + this.FILEEXT_ICON_MAP[file_ext];
    } else {
      return mediaUrl + 'img/file/' + size + '/' + this.FILEEXT_ICON_MAP['default'];
    }
  },

  sharePerms: function (permission) {
    var title;
    switch (permission) {
      case 'rw':
        title = gettext('Read-Write');
        break;
      case 'r':
        title = gettext('Read-Only');
        break;
      case 'submit':
        title = gettext('Submit');
        break;
      case 'admin':
        title = gettext('Admin');
        break;
      case 'cloud-edit':
        title = gettext('Online Read-Write');
        break;
      case 'preview':
        title = gettext('Online Read-Only');
        break;
      default:
        break;
    }
    return title;
  },

  sharePermsExplanation: function (permission) {
    var title;
    switch (permission) {
      case 'rw':
        title = gettext('User can read, write, upload, download and sync files.');
        break;
      case 'r':
        title = gettext('User can read, download and sync files.');
        break;
      case 'admin':
        title = gettext('Besides write permission, user can also share the library.');
        break;
      case 'cloud-edit':
        title = gettext('User can view and edit file online via browser. Files can\'t be downloaded.');
        break;
      case 'preview':
        title = gettext('User can only view files online via browser. Files can\'t be downloaded.');
        break;
      default:
        break;
    }
    return title;
  },

  dtableSharePermsExplanation: function (permission) {
    var title;
    switch (permission) {
      case 'rw':
        title = gettext('User can read, write the base. Can\'t add plugins or share the base.');
        break;
      case 'r':
        title = gettext('User can read the base, but can\'t modify it.');
        break;
      case 'submit':
        title = gettext('User can only add rows, see and modify the rows they created. Can\'t see the rows created by others.');
        break;
      default:
        break;
    }
    return title;
  },

  getShareLinkPermissionObject: function (permission) {
    switch (permission) {
      case 'preview_download':
        return {
          value: permission,
          text: gettext('Preview and download'),
          permissionDetails: {
            'can_edit': false,
            'can_download': true
          }
        };
      case 'preview_only':
        return {
          value: permission,
          text: gettext('Preview only'),
          permissionDetails: {
            'can_edit': false,
            'can_download': false
          }
        };
      case 'edit_download':
        return {
          value: permission,
          text: gettext('Edit on cloud and download'),
          permissionDetails: {
            'can_edit': true,
            'can_download': true
          }
        };
      default:
        return null;
    }
  },

  getDTableShareLinkPermissionObject: function (permission) {
    switch (permission) {
      case 'read-only':
        return {
          value: permission,
          text: gettext('read-only'),
          permission: 'r'
        };
      case 'read-write':
        return {
          value: permission,
          text: gettext('read-write'),
          permission: 'rw'
        };
      default:
        return null;
    }
  },

  formatSize: function (options) {
    /*
     * param: {bytes, precision}
     */
    var bytes = options.bytes;
    var precision = options.precision || 0;

    var kilobyte = 1000;
    var megabyte = kilobyte * 1000;
    var gigabyte = megabyte * 1000;
    var terabyte = gigabyte * 1000;

    if ((bytes >= 0) && (bytes < kilobyte)) {
      return bytes + ' B';

    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
      return (bytes / kilobyte).toFixed(precision) + ' KB';

    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
      return (bytes / megabyte).toFixed(precision) + ' MB';

    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
      return (bytes / gigabyte).toFixed(precision) + ' GB';

    } else if (bytes >= terabyte) {
      return (bytes / terabyte).toFixed(precision) + ' TB';

    } else {
      return bytes + ' B';
    }
  },

  formatBitRate: function (bits) {
    var Bs;
    if (typeof bits !== 'number') {
      return '';
    }
    Bs = bits / 8;
    if (Bs >= 1000000000) {
      return (Bs / 1000000000).toFixed(2) + ' GB/s';
    }
    if (Bs >= 1000000) {
      return (Bs / 1000000).toFixed(2) + ' MB/s';
    }
    if (Bs >= 1000) {
      return (Bs / 1000).toFixed(2) + ' kB/s';
    }
    return Bs.toFixed(2) + ' B/s';
  },

  isInternalDirLink: function (url, repoID) {
    var re = new RegExp(serviceURL + '/library/' + repoID + '.*');
    return re.test(url);
  },

  compareTwoWord: function (wordA, wordB) {
    // compare wordA and wordB at lower case
    // if wordA >= wordB, return 1
    // if wordA < wordB, return -1

    var a_val; var b_val;
    var a_uni = wordA.charCodeAt(0);
    var b_uni = wordB.charCodeAt(0);

    if ((19968 < a_uni && a_uni < 40869) && (19968 < b_uni && b_uni < 40869)) {
      // both are chinese words
      a_val = strChineseFirstPY.charAt(a_uni - 19968).toLowerCase();
      b_val = strChineseFirstPY.charAt(b_uni - 19968).toLowerCase();
    } else if ((19968 < a_uni && a_uni < 40869) && !(19968 < b_uni && b_uni < 40869)) {
      // a is chinese and b is english
      return 1;
    } else if (!(19968 < a_uni && a_uni < 40869) && (19968 < b_uni && b_uni < 40869)) {
      // a is english and b is chinese
      return -1;
    } else {
      // both are english words
      a_val = wordA.toLowerCase();
      b_val = wordB.toLowerCase();
      return this.compareStrWithNumbersIn(a_val, b_val);
    }

    return a_val >= b_val ? 1 : -1;
  },

  // compare two strings which may have digits in them
  // and compare those digits as number instead of string
  compareStrWithNumbersIn: function (a, b) {
    var reParts = /\d+|\D+/g;
    var reDigit = /\d/;
    var aParts = a.match(reParts);
    var bParts = b.match(reParts);
    var isDigitPart;
    var len = Math.min(aParts.length, bParts.length);
    var aPart; var bPart;

    if (aParts && bParts &&
      (isDigitPart = reDigit.test(aParts[0])) === reDigit.test(bParts[0])) {
      // Loop through each substring part to compare the overall strings.
      for (var i = 0; i < len; i++) {
        aPart = aParts[i];
        bPart = bParts[i];

        if (isDigitPart) {
          aPart = parseInt(aPart, 10);
          bPart = parseInt(bPart, 10);
        }

        if (aPart !== bPart) {
          return aPart < bPart ? -1 : 1;
        }

        // Toggle the value of isDigitPart since the parts will alternate.
        isDigitPart = !isDigitPart;
      }
    }

    // Use normal comparison.
    return (a >= b) - (a <= b);
  },

  /*
   * only used in the 'catch' part of a seatable request
   */
  getErrorMsg: function (error, showPermissionDeniedTip) {
    let errorMsg = '';
    if (error.response) {
      if (error.response.status === 403) {
        if (error.response?.data?.error_msg === 'The number of users exceeds the limit.') {
          return gettext('The number of users exceeds the limit.');
        } else {
          errorMsg = gettext('Permission denied');
        }
        if (showPermissionDeniedTip) {
          toaster.danger(
            <PermissionDeniedTip />,
            { id: 'permission_denied', duration: 3600 }
          );
        }
      } else if (error.response.data &&
        error.response.data['error_msg']) {
        errorMsg = error.response.data['error_msg'];
      } else {
        errorMsg = gettext('Error');
      }
    } else {
      if (typeof error === 'object' && error.name) {
        errorMsg = error.name;
      } else {
        errorMsg = gettext('Please check the network.');
      }
      // eslint-disable-next-line
      console.log(error);
    }
    return errorMsg;
  },

  chooseLanguage: function (suffix) {
    let mode;
    switch (suffix) {
      case 'py':
        mode = 'python';
        break;
      case 'js':
        mode = 'javascript';
        break;
      case 'c':
        mode = 'text/x-csrc';
        break;
      case 'cpp':
        mode = 'text/x-c++src';
        break;
      case 'java':
        mode = 'text/x-java';
        break;
      case 'cs':
        mode = 'text/x-csharp';
        break;
      case 'mdf':
        mode = 'text/x-sql';
        break;
      case 'html':
        mode = 'htmlmixed';
        break;
      default:
        mode = suffix;
    }
    return mode;
  },

  generatePassword: function (passwordLength) {
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < passwordLength; i++) {
      password += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return password;
  },

  pathNormalize: function (originalPath) {
    let oldPath = originalPath.split('/');
    let newPath = [];
    for (let i = 0; i < oldPath.length; i++) {
      if (oldPath[i] === '.' || oldPath[i] === '') {
        continue;
      } else if (oldPath[i] === '..') {
        newPath.pop();
      } else {
        newPath.push(oldPath[i]);
      }
    }
    return newPath.join('/');
  },

  getEventData: function (event, data) {
    if (event.target.dataset) {
      return event.target.dataset[data];
    }
    return event.target.getAttribute('data-' + data);

  },

  formatTime: function (seconds) {
    var ss = parseInt(seconds);
    var mm = 0;
    var hh = 0;
    if (ss > 60) {
      mm = parseInt(ss / 60);
      ss = parseInt(ss % 60);
    }
    if (mm > 60) {
      hh = parseInt(mm / 60);
      mm = parseInt(mm % 60);
    }

    var result = ('00' + parseInt(ss)).slice(-2);
    if (mm > 0) {
      result = ('00' + parseInt(mm)).slice(-2) + ':' + result;
    } else {
      result = '00:' + result;
    }
    if (hh > 0) {
      result = ('00' + parseInt(hh)).slice(-2) + ':' + result;
    } else {
      result = '00:' + result;
    }
    return result;
  },

  hasNextPage(curPage, perPage, totalCount) {
    return curPage * perPage < totalCount;
  },

  getPluginName(plugin) {
    let plugin_name = plugin.info.display_name;
    if (typeof plugin_name === 'object') {
      let language = lang;
      plugin_name = plugin_name[language.toLowerCase()] || plugin_name['en'];
    }
    return plugin_name;
  },

  getPluginDescription(plugin) {
    let plugin_description = plugin.info.description;
    if (typeof plugin_description === 'object') {
      let language = lang;
      plugin_description = plugin_description[language.toLowerCase()] || plugin_description['en'];
    }
    return plugin_description;
  },

  compareVersion(preVersion, lastVersion) {
    let sources = preVersion.split('.');
    let dests = lastVersion.split('.');
    let maxL = Math.max(sources.length, dests.length);
    let result = false;
    for (let i = 0; i < maxL; i++) {
      let preValue = sources.length > i ? sources[i] : 0;
      let preNum = isNaN(Number(preValue)) ? preValue.charCodeAt() : Number(preValue);
      let lastValue = dests.length > i ? dests[i] : 0;
      let lastNum = isNaN(Number(lastValue)) ? lastValue.charCodeAt() : Number(lastValue);
      if (preNum < lastNum) {
        result = true;
        break;
      } else if (preNum > lastNum) {
        break;
      }
    }
    return result;
  },

  getUrlSearches() {
    const search = location.search;
    let searchParams = {};
    if (search.length === 0) {
      return searchParams;
    }
    let allSearches = search.split('?')[1];
    let allSearchesArr = allSearches.split('&');
    allSearchesArr.forEach(item => {
      let itemArr = item.split('=');
      searchParams[itemArr[0]] = decodeURI(itemArr[1]);
    });
    return searchParams;
  },

  updateSearchParameter(key, value) {
    let newSearch = value ? `?${key}=${value}` : '';
    history.replaceState(null, '', location.pathname + newSearch);
  },

  debounce(fn, wait = 100) {
    let timer = null;
    return (...args) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        fn.apply(this, args);
      }, wait);
    };
  },

  throttle(func, delay) {
    let timer = null;
    let startTime = Date.now();
    return function () {
      let curTime = Date.now();
      let remaining = delay - (curTime - startTime);
      let context = this;
      let args = arguments;
      clearTimeout(timer);
      if (remaining <= 0) {
        func.apply(context, args);
        startTime = Date.now();
      } else {
        timer = setTimeout(func, remaining);
      }
    };
  },

  checkSVGImage(url) {
    if (!url) return false;
    const isSVGImage = url.substr(-4).toLowerCase() === '.svg';
    return isSVGImage;
  },

  getImageThumbnailUrl(url, size) {
    if (this.checkSVGImage(url)) {
      return url;
    }
    size = size || 256;
    return url.replace('/workspace', '/thumbnail/workspace') + '?size=' + size;
  },

  needUseThumbnailImage(url) {
    if (!url || url.lastIndexOf('.') === -1) {
      return false;
    }
    const image_suffix = url.substr(url.lastIndexOf('.') + 1).toLowerCase();
    const suffix = ['bmp', 'tif', 'tiff'];
    return suffix.includes(image_suffix);
  },

};

export const isIPhone = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone/gi.test(userAgent);
};

export const isShiftKeyDown = (e) => {
  return e && e.shiftKey;
};

export const isMac = () => {
  const platform = navigator.platform;
  return (platform === 'Mac68K') || (platform === 'MacPPC') || (platform === 'Macintosh') || (platform === 'MacIntel');
};

export const isQQBuiltInBrowser = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.indexOf(' qq') > -1 && userAgent.indexOf('mqqbrowser') < 0 ;
};

export const validateName = (name) => {
  if (typeof name !== 'string') {
    return { isValid: false, message: gettext('Name should be string') };
  }
  name = name.trim();
  if (name === '') {
    return { isValid: false, message: gettext('Name is required') };
  }
  if (name.includes('/')) {
    return { isValid: false, message: gettext('Name cannot contain slash') };
  }
  if (name.includes('\\')) {
    return { isValid: false, message: gettext('Name cannot contain backslash') };
  }
  return { isValid: true, message: name };
};

export const getNoticeItemAvatarUrl = (noticeItem) => {
  const detail = noticeItem.detail;
  switch (noticeItem.type) {
    case NOTIFICATION_TYPE.SHARE_DTABLE_TO_USER: {
      return detail.share_from.share_from_user_avatar_url;
    }
    case NOTIFICATION_TYPE.SUBMIT_FORM: {
      return detail.submit_user.submit_user_avatar_url;
    }
    case NOTIFICATION_TYPE.ADD_USER_TO_GROUP: {
      return detail.group_staff_avatar_url;
    }
    case NOTIFICATION_TYPE.LICENSE_EXPIRING: {
      return avatarURL;
    }
    default: {
      return null;
    }
  }
};

export const getNoticeItemUserName = (noticeItem) => {
  const detail = noticeItem.detail;
  switch (noticeItem.type) {
    case NOTIFICATION_TYPE.SHARE_DTABLE_TO_USER: {
      return detail.share_from.share_from_user_name;
    }
    case NOTIFICATION_TYPE.SUBMIT_FORM: {
      if (!detail.submit_user) return null;
      return detail.submit_user.submit_user_name;
    }
    case NOTIFICATION_TYPE.ADD_USER_TO_GROUP: {
      return detail.group_staff_name;
    }
    default: {
      return null;
    }
  }
};

export const formatStringToRegexp = (string) => {
  const reg = new RegExp(string); // get regExp
  return reg;
};

export const isMobile = (typeof (window) !== 'undefined') && (window.innerWidth < 768 ||
  navigator.userAgent.toLowerCase().match(/(ipod|ipad|iphone|android|coolpad|mmp|smartphone|midp|wap|xoom|symbian|j2me|blackberry|wince)/i) != null);

export const getPerPage = (contentHeight, { height, marginBottom } = {}) => {
  return parseInt(contentHeight / (height + marginBottom)) + 1;
};

export const DIALOG_MAX_HEIGHT = window.innerHeight - 56; // Dialog margin is 3.5rem (56px)

export const PER_PAGE = Math.max(getPerPage(DIALOG_MAX_HEIGHT, { height: 88, marginBottom: 8 }), 10);

export const isFunction = (functionToCheck) => {
  const getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
};

export const getEventClassName = (e) => {
  // svg mouseEvent event.target.className is an object
  if (!e || !e.target) return '';
  return e.target.getAttribute('class') || '';
};

export const getFirstDayOfWeek = () => {
  const { lang } = window.app.config;
  const pageOptions = window.shared?.pageOptions;
  const dtableMetadata = pageOptions?.dtableMetadata;

  if (!dtableMetadata) return lang === 'zh-cn' ? 'Sunday' : 'Monday';

  const { metadata } = JSON.parse(dtableMetadata);
  const { settings } = metadata || {};
  const { date_settings } = settings || {};
  let firstDayOfWeek = date_settings?.first_day_of_week;

  if (!firstDayOfWeek) {
    firstDayOfWeek = lang === 'zh-cn' ? 'Sunday' : 'Monday';
  }
  return firstDayOfWeek;
};
