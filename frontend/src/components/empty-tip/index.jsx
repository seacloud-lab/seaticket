import React from 'react';
import PropTypes from 'prop-types';
import './index.css';

const { mediaUrl } = window.app.config;

const EmptyTip = ({ text, title, type, src, children }) => {
  return (
    <div className="empty-tip">
      <img src={src || `${mediaUrl}img/no-items-tip.png`} alt="" width="88" height="88" className="no-items-img-tip" />
      {title && <span className="empty-tip-title">{title}</span>}
      {text && <span className="empty-tip-text" style={{ color: type === 'error' ? 'red' : '#999' }}>{text}</span>}
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
