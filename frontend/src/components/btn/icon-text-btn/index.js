import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';
import Loading from '@/components/loading';

import './index.css';

const IconTextBtn = ({
  icon,
  text,
  color = 'primary',
  className = '',
  disabled = false,
  isLoading = false,
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
      className={classnames('sea-ticket-icon-text-btn', className, { [`sea-ticket-${icon}-text-btn`]: icon, 'cursor-pointer': !disabled }, `sea-ticket-${color}-icon-text-btn`)}
      title={text}
      aria-label={text}
      role={disabled ? '' : 'button'}
      tabIndex="0"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      { ...props }
    >
      {icon && (<Icon symbol={icon} className="mr-2" aria-hidden="true" />)}
      {isLoading && (<Loading />)}
      <span>{text}</span>
    </div>
  );
};

export default IconTextBtn;
