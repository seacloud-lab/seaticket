import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const IconTextBtn = ({
  icon,
  text,
  color = 'primary',
  className = '',
  onClick,
  ...props
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) {
        onClick(e);
      }
    }
  };
  return (
    <div
      className={classnames('sea-ticket-icon-text-btn', className, (icon ? `sea-ticket-${icon}-text-btn` : ''), `sea-ticket-${color}-icon-text-btn`)}
      title={text}
      aria-label={text}
      role="button"
      tabIndex="0"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      { ...props }
    >
      {icon && (<Icon symbol={icon} className="mr-2" aria-hidden="true" />)}
      <span>{text}</span>
    </div>
  );
};

export default IconTextBtn;
