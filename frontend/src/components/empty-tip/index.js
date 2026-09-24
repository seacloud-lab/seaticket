import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { mediaUrl } from '@/constants';

import './index.css';

const EmptyTip = ({ text, title, type, src, className, innerRef, style, children }) => {
  return (
    <div className={classnames('empty-tip', className)} ref={innerRef} style={style}>
      {src && <img src={src || `${mediaUrl}img/no-items-tip.png`} alt="" width="64" height="64" className="no-items-img-tip" />}
      {title && <span className="empty-tip-title">{title}</span>}
      {text && <span className="empty-tip-text mt-4" style={{ color: type === 'error' ? 'red' : 'var(--bs-sf-grey-text)' }}>{text}</span>}
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
