import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import IconButton from '../icon-button';

import './index.css';

const decodeEscapedUnicode = (value) => {
  if (typeof value !== 'string' || value.indexOf('\\u') === -1) return value;
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
};

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
  const decodedTip = decodeEscapedUnicode(tip);

  const ref = useRef(null);

  const handleClick = useCallback((event) => {
    setIsShowPopover(true);
    onClick && onClick(event);
  }, [onClick]);

  useEffect(() => {
    if (!isShowPopover) return;
    const handleScroll = (event) => {
      if (event.target.closest('.seaqa-tip-popover-container')) return;
      setIsShowPopover(false);
    };

    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isShowPopover]);

  return (
    <>
      <IconButton
        icon={icon}
        ref={ref}
        className={classnames('seaqa-tooltip-icon-btn', { 'no-hover-bg': !hoverBackground }, className)}
        onClick={handleClick}
        { ...props }
      />
      {decodedTip && isShowPopover && (
        <CustomizePopover
          target={ref}
          placement={placement}
          className={classnames('seaqa-tip-popover', popoverClassName)}
          containerClassName="seaqa-tip-popover-container"
          hidePopover={() => setIsShowPopover(false)}
          hidePopoverWithEsc={() => setIsShowPopover(false)}
        >
          {decodedTip}
        </CustomizePopover>
      )}
    </>
  );
};

export default IconPopoverTip;
