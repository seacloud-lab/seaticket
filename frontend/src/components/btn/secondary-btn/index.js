import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const SecondaryBtn = ({ icon, text, isSmall, disabled, className, onClick, ...rest }) => {
  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      if (onClick) {
        onClick(e);
      }
    }
  };

  return (
    <div
      className={classnames('sea-ticket-secondary-btn', className, `sea-ticket-${icon}-secondary-btn`, {
        'sea-ticket-secondary-icon-btn': icon,
        'sea-ticket-secondary-small-btn': isSmall,
        'disabled': disabled,
      })}
      title={text}
      aria-label={text}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : handleKeyDown}
      { ...rest }
    >
      {icon && (<Icon symbol={icon} className="mr-2" aria-hidden="true" />)}
      <span>{text}</span>
    </div>
  );
};

export default SecondaryBtn;
