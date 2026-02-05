import React from 'react';
import classnames from 'classnames';
import IconButton from '../icon-button';
import IconTooltip from '../icon-tooltip';

import './index.css';

const ClearIconButton = ({
  useTooltip = false,
  title = '',
  className,
  ...params
}) => {
  const _className = classnames('sea-ticket-clear-icon-button no-hover-bg', className);
  if (useTooltip) {
    return (
      <IconTooltip
        className={_className}
        icon="close-circle-filled"
        tip={title}
        placement="bottom"
        { ...params }
      />
    );
  }
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
