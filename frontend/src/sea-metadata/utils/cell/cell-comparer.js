import ObjectUtils, { isEmptyObject } from '@/utils/object-utils';

export const isCellValueChanged = (oldVal, newVal, columnType) => {
  if (oldVal === newVal) return false;
  if (oldVal === undefined || oldVal === null || oldVal === '') {
    if (newVal === undefined || newVal === null || newVal === '') return false;
    if (typeof newVal === 'object' && isEmptyObject(newVal)) return false;
    if (Array.isArray(newVal)) return newVal.length !== 0;
    if (typeof newVal === 'boolean') return newVal !== false;
  }
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    // [{}].toString(): [object Object]
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  }
  if (typeof oldVal === 'object' && typeof newVal === 'object' && newVal !== null) {
    return !ObjectUtils.isSameObject(oldVal, newVal);
  }
  return oldVal !== newVal;
};
