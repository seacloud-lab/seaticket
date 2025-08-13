import React from 'react';
import PropTypes from 'prop-types';

const Empty = ({ columnType, placeholder }) => {
  return (<span className={`sea-metadata-row-cell-empty sea-metadata-row-${columnType}-cell-empty`} placeholder={placeholder}></span>);
};

Empty.propTypes = {
  columnType: PropTypes.string,
  placeholder: PropTypes.string,
};

export default Empty;
