import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

const ReplyStatusFormatter = ({ value, className }) => {
  if (!value) return null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container reply-status-formatter', className)}>
      <svg className="reply-status-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
      </svg>
    </div>
  );
};

ReplyStatusFormatter.propTypes = {
  value: PropTypes.bool,
  className: PropTypes.string,
};

export default ReplyStatusFormatter;
