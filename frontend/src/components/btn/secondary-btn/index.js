import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const SecondaryBtn = ({ icon, text, isSmall, disabled, className, ...rest }) => {
  return (
    <div
      className={classnames('sea-ticket-secondary-btn', className, `sea-ticket-${icon}-secondary-btn`, {
        'sea-ticket-secondary-icon-btn': icon,
        'sea-ticket-secondary-small-btn': isSmall,
        'disabled': disabled,
      })}
      title={text}
      aria-label={text}
      { ...rest }
    >
      {icon && (<Icon symbol={icon} className="mr-2" />)}
      <span>{text}</span>
    </div>
  );
};

export default SecondaryBtn;
