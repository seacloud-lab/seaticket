import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Icon } from '@/components';

import './index.css';

const ReplyStatusFormatter = ({ value, className }) => {
  if (!value) return null;

  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container reply-status-formatter', className)}>
      <Icon symbol="reply-status" className="reply-status-icon" />
    </div>
  );
};

ReplyStatusFormatter.propTypes = {
  value: PropTypes.bool,
  className: PropTypes.string,
};

export default ReplyStatusFormatter;
