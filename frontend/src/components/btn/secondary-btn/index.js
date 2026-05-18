import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';
import Loading from '@/components/loading';

import './index.css';

const SecondaryBtn = ({ icon = '', text, isSmall, disabled, doing, className = '', onClick, ...rest }) => {
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
      className={classnames('seaqa-secondary-btn', className, `seaqa-${icon}-secondary-btn`, {
        'seaqa-secondary-icon-btn': icon,
        'seaqa-secondary-small-btn': isSmall,
        'disabled': disabled,
        'doing': doing,
      })}
      title={text}
      aria-label={text}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled || doing ? undefined : onClick}
      onKeyDown={disabled || doing ? undefined : handleKeyDown}
      { ...rest }
    >
      {icon && (
        <>
          {icon === 'loading' ? (<Loading />) : (<Icon symbol={icon} aria-hidden="true" />)}
        </>
      )}
      <span>{text}</span>
    </div>
  );
};

export default SecondaryBtn;
