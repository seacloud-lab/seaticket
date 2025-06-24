import React from 'react';
import PropTypes from 'prop-types';

import './index.css';

const components = {};
const requireContext = require.context('../../assets/icons', false, /\.svg$/);

requireContext.keys().forEach(path => {
  const iconName = path.replace(/^\.\/(.*?)\.svg$/, '$1').toLowerCase();
  components[iconName] = requireContext(path).default;
});

function Icon({ className, symbol }) {
  const iconClass = `multicolor-icon multicolor-icon-${symbol} ${className || ''}`;
  const props = { className: iconClass };
  const Component = components[symbol];
  if (!Component) return null;
  return (<Component { ...props } />);
}

Icon.propTypes = {
  symbol: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default Icon;
