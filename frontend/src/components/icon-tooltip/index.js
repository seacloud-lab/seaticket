import React, { useRef } from 'react';
import classnames from 'classnames';
import IconButton from '../icon-button';
import Tooltip from '../tooltip';

import './index.css';

const IconTooltip = ({ icon = 'question-circle-filled', tip, className, placement = 'right', hoverBackground = false, ...props }) => {
  const ref = useRef(null);
  return (
    <>
      <IconButton
        icon={icon}
        ref={ref}
        className={classnames('sea-qa-tooltip-icon-btn', { 'no-hover-bg': !hoverBackground }, className)}
        { ...props }
      />
      <Tooltip target={ref} placement={placement}>
        {tip}
      </Tooltip>
    </>
  );
};

export default IconTooltip;
