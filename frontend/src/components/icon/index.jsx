import React from 'react';
import PropTypes from 'prop-types';

import './index.css';

const components = {};
const requireContext = require.context('../../assets/icons', false, /\.svg$/);

requireContext.keys().forEach(path => {
  const iconName = path.replace(/^\.\/(.*?)\.svg$/, '$1').toLowerCase();
  components[iconName] = requireContext(path).default;
});

function Icon({ className, symbol, ...otherProps }) {
  const SvgComponent = components[symbol];
  if (!SvgComponent) return null;
  return (
    <SvgComponent className={`seaqa-icon-svg seaqa-icon-svg-${symbol} ${className ?? ''}`} aria-hidden="true" {...otherProps} />
  );
}

Icon.propTypes = {
  symbol: PropTypes.string,
  className: PropTypes.string,
};

export default Icon;
