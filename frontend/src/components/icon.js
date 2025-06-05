import React from 'react';
import PropTypes from 'prop-types';

import '../css/icon.css';

const importAll = (requireContext) => {
  requireContext.keys().forEach(requireContext);
};
try {
  importAll(require.context('../assets/icon', true, /\.svg$/));
} catch (error) {
  // eslint-disable-next-line no-console
  console.log(error);
}

const Icon = (props) => {
  const { className, title, symbol, color, onClick = () => {} } = props;
  const iconClass = `multicolor-icon multicolor-icon-${symbol} ${className || ''}`;
  return (
    <svg className={iconClass} style={{ color: color }} onClick={onClick} aria-hidden="true">
      <use xlinkHref={`#${symbol}`} />
      <title>{title}</title>
    </svg>
  );
};

Icon.propTypes = {
  symbol: PropTypes.string.isRequired,
  color: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  onClick: PropTypes.func,
};

export default Icon;
