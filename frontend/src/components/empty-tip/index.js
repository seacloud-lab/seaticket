import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './index.css';

const { mediaUrl } = window.app.config;

const EmptyTip = ({ text, title, type, src, className, children }) => {
  return (
    <div className={classnames('empty-tip', className)}>
      <img src={src || `${mediaUrl}img/no-items-tip.png`} alt="" width="88" height="88" className="no-items-img-tip" />
      {title && <span className="empty-tip-title">{title}</span>}
      {text && <span className="empty-tip-text" style={{ color: type === 'error' ? 'red' : '#666' }}>{text}</span>}
      {children}
    </div>
  );
};

EmptyTip.propTypes = {
  src: PropTypes.string,
  title: PropTypes.string,
  text: PropTypes.string,
  type: PropTypes.string,
  children: PropTypes.element,
};

export default EmptyTip;
