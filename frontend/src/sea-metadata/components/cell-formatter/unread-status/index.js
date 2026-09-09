import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';

import './index.css';

const UnreadStatusFormatter = ({ value, className }) => {
  if (!value) return null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container unread-status-formatter', className)}>
      <span className="unread-status-dot"></span>
    </div>
  );
};

UnreadStatusFormatter.propTypes = {
  value: PropTypes.bool,
  className: PropTypes.string,
};

export default UnreadStatusFormatter;
