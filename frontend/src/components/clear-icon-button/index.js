import React from 'react';
import classnames from 'classnames';
import IconButton from '../icon-button';

import './index.css';

const ClearIconButton = ({
  useTooltip = false,
  title = '',
  className,
  ...params
}) => {
  const _className = classnames('sea-ticket-clear-icon-button no-hover-bg', className);
  return (
    <IconButton
      className={_className}
      icon="close-circle-filled"
      title={title}
      { ...params }
    />
  );

};

export default ClearIconButton;
