import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const IconTextBtn = ({
  icon,
  text,
  className,
  ...props
}) => {
  return (
    <div
      className={classnames('sea-ticket-icon-text-btn', className, `sea-ticket-${icon}-text-btn`)}
      title={text}
      aria-label={text}
      { ...props }
    >
      <Icon symbol={icon} className="mr-2" />
      <span>{text}</span>
    </div>
  );
};

export default IconTextBtn;
