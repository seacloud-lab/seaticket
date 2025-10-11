/**
 * Check whether is number
 * @param {number} number
 * @returns boolean
 */
export const isNumber = (number) => (number || number === 0) && Object.prototype.toString.call(number) === '[object Number]';

/**
 * Check whether is object
 * @param {object} object
 * @returns boolean
 */
export const isObject = (object) => object && Object.prototype.toString.call(object) === '[object Object]';
