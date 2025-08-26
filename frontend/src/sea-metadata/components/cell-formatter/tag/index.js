import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

const TagFormatter = ({ value, row, column, className, onClick }) => {

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container tag-formatter', className)}>
      <div className="sea-metadata-tag-formatter-color" style={{ backgroundColor: row.color }}></div>
      <div
        className={classnames('sea-metadata-tag-formatter-name', { 'hover-decoration': column?.click })}
        title={value}
        onClick={column?.click && onClick ? onClick : () => {}}
      >
        {value}
      </div>
    </div>
  );
};

TagFormatter.propTypes = {
  row: PropTypes.object,
  className: PropTypes.string,
};

export default TagFormatter;
