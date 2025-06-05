class ObjectUtils {

  static getDataType(data) {
    let type = typeof data;
    if (type !== 'object') {
      return type;
    }
    return Object.prototype.toString.call(data).replace(/^\[object (\S+)\]$/, '$1');
  }

  static iterable(data) {
    return ['Object', 'Array'].includes(this.getDataType(data));
  }

  static isObjectHasKey(obj, key) {
    return Object.keys(obj).includes(key);
  }

  static isObjectChanged(source, comparison) {
    if (!this.iterable(source)) {
      throw new Error(`source should be a Object or Array , but got ${this.getDataType(source)}`);
    }
    if (this.getDataType(source) !== this.getDataType(comparison)) {
      return true;
    }
    const sourceKeys = Object.keys(source);
    const comparisonKeys = Object.keys({ ...source, ...comparison });
    if (sourceKeys.length !== comparisonKeys.length) {
      return true;
    }
    return comparisonKeys.some(key => {
      if (this.iterable(source[key])) {
        return this.isObjectChanged(source[key], comparison[key]);
      } else {
        return source[key] !== comparison[key];
      }
    });
  }

  static isSameObject(source, comparison) {
    if (!source || !comparison) return false;
    return !this.isObjectChanged(source, comparison);
  }

  static getArraysIntersection = (arr1, arr2) => {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    return [...set1].filter(item => set2.has(item));
  };
}

export default ObjectUtils;
