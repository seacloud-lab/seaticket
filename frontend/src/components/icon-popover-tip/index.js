import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import IconButton from '../icon-button';
import CustomizePopover from '../customize-popover';

import './index.css';

const IconPopoverTip = ({
  icon = 'question-circle-stroked',
  tip,
  className,
  popoverClassName,
  placement = 'bottom-start',
  hoverBackground = false,
  onClick,
  ...props
}) => {
  const [isShowPopover, setIsShowPopover] = useState(false);

  const handleClick = useCallback((event) => {
    setIsShowPopover(true);
    onClick && onClick(event);
  }, [onClick]);

  const ref = useRef(null);
  return (
    <>
      <IconButton
        icon={icon}
        ref={ref}
        className={classnames('seaqa-tooltip-icon-btn', { 'no-hover-bg': !hoverBackground }, className)}
        onClick={handleClick}
        { ...props }
      />
      {tip && isShowPopover && (
        <CustomizePopover
          target={ref}
          placement={placement}
          className={classnames('seaqa-tip-popover', popoverClassName)}
          hidePopover={() => setIsShowPopover(false)}
          hidePopoverWithEsc={() => setIsShowPopover(false)}
        >
          <div className="seaqa-tip-popover-container">{tip}</div>
        </CustomizePopover>
      )}
    </>
  );
};

export default IconPopoverTip;
