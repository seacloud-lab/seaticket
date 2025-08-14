export const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);

export const getEventClassName = (e) => {
  // svg mouseEvent event.target.className is an object
  if (!e || !e.target) return '';
  return e.target.getAttribute('class') || '';
};

export const addClassName = (originClassName, targetClassName) => {
  const originClassNames = originClassName.split(' ');
  if (originClassNames.indexOf(targetClassName) > -1) return originClassName;
  return originClassName + ' ' + targetClassName;
};

export const removeClassName = (originClassName, targetClassName) => {
  let originClassNames = originClassName.split(' ');
  const targetClassNameIndex = originClassNames.indexOf(targetClassName);
  if (targetClassNameIndex < 0) return originClassName;
  originClassNames.splice(targetClassNameIndex, 1);
  return originClassNames.join(' ');
};

export function hasClass(node, className) {
  if (node.classList) {
    return node.classList.contains(className);
  }
  const originClass = node.className;
  return ` ${originClass} `.indexOf(` ${className} `) > -1;
}

export function addClass(node, className) {
  if (node.classList) {
    node.classList.add(className);
  } else {
    if (!hasClass(node, className)) {
      node.className = `${node.className} ${className}`;
    }
  }
}

export function removeClass(node, className) {
  if (node.classList) {
    node.classList.remove(className);
  } else {
    if (hasClass(node, className)) {
      const originClass = node.className;
      node.className = ` ${originClass} `.replace(` ${className} `, '');
    }
  }
}

export const getDataAttr = props => {
  return Object.keys(props).reduce((prev, key) => {
    if (
      key.substr(0, 5) === 'aria-' ||
      key.substr(0, 5) === 'data-' ||
      key === 'role'
    ) {
      prev[key] = props[key];
    }
    return prev;
  }, {});
};

const isReactRefObj = (target) => {
  if (target && typeof target === 'object') return 'current' in target;
  return false;
};

const getTag = (value) => {
  if (value == null) return value === undefined ? '[object Undefined]' : '[object Null]';
  return Object.prototype.toString.call(value);
};

const isObject = (value) => {
  const type = typeof value;
  return value != null && (type === 'object' || type === 'function');
};

const isFunction = (value) => {
  if (!isObject(value)) return false;
  const tag = getTag(value);
  return (
    tag === '[object Function]' ||
    tag === '[object AsyncFunction]' ||
    tag === '[object GeneratorFunction]' ||
    tag === '[object Proxy]'
  );
};

const findDOMElements = (target) => {
  if (isReactRefObj(target)) return target.current;
  if (isFunction(target)) return target();
  if (typeof target === 'string' && canUseDOM) {
    let selection = document.querySelectorAll(target);
    if (!selection.length) {
      selection = document.querySelectorAll(`#${target}`);
    }
    if (!selection.length) {
      throw new Error(
        `The target '${target}' could not be identified in the dom, tip: check spelling`,
      );
    }
    return selection;
  }
  return target;
};

const isArrayOrNodeList = (els) => {
  if (els === null) return false;
  return Array.isArray(els) || (canUseDOM && typeof els.length === 'number');
};

export const getTarget = (target, allElements) => {
  const els = findDOMElements(target);
  if (!allElements) {
    if (isArrayOrNodeList(els)) return els;
    if (els === null) return null;
    return els;
  }
  if (isArrayOrNodeList(els)) return els[0];
  return els[0];
};
