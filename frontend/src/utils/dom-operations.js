export const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);

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
