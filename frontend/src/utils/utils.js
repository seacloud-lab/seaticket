import React from 'react';
import toaster from '../components/toaster';
import { gettext } from '../constants/config';
import PermissionDeniedTip from '../components/permission-denied-tip';
import { canUseDOM } from './dom';

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

  isIEBrowser: function () { // is ie <= ie11 not include Edge
    var userAgent = navigator.userAgent;
    var isIE = userAgent.indexOf('compatible') > -1 && userAgent.indexOf('MSIE') > -1;
    var isIE11 = userAgent.indexOf('Trident') > -1 && userAgent.indexOf('rv:11.0') > -1;
    return isIE || isIE11;
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
      if (typeof error === 'object' && error.message) {
        errorMsg = error.message;
      } else {
        errorMsg = gettext('Please check the network.');
      }
      // eslint-disable-next-line
      console.log(error);
    }
    return errorMsg;
  },

  generateSecureRandomInRange: function (min, max) {
    const start = Math.min(min, max);
    const end = Math.max(min, max);
    const range = end - start + 1;
    const byteSize = Math.ceil(Math.log2(range) / 8);

    const randomBytes = new Uint8Array(byteSize);
    window.crypto.getRandomValues(randomBytes);

    const randomValue = Array.from(randomBytes).reduce((pre, byte) => (pre << 8) | byte, 0);
    return start + (randomValue % range);
  },

  generatePassword: function (length = 8) {

    var password = '';

    // 65~90：A~Z
    password += String.fromCharCode(this.generateSecureRandomInRange(65, 90));

    // 97~122：a~z
    password += String.fromCharCode(this.generateSecureRandomInRange(97, 122));

    // 48~57：0~9
    password += String.fromCharCode(this.generateSecureRandomInRange(48, 57));

    // 33~47：!~/
    password += String.fromCharCode(this.generateSecureRandomInRange(33, 47));

    // 33~47：!~/
    // 48~57：0~9
    // 58~64：:~@
    // 65~90：A~Z
    // 91~96：[~`
    // 97~122：a~z
    // 123~127：{~
    for (var i = 0; i < length - 4; i++) {
      password += String.fromCharCode(this.generateSecureRandomInRange(33, 127));
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

export const formatStringToRegexp = (string) => {
  const reg = new RegExp(string); // get regExp
  return reg;
};

export const isMobile = (typeof (window) !== 'undefined') && (window.innerWidth < 768 ||
  navigator.userAgent.toLowerCase().match(/(ipod|ipad|iphone|android|coolpad|mmp|smartphone|midp|wap|xoom|symbian|j2me|blackberry|wince)/i) != null);

