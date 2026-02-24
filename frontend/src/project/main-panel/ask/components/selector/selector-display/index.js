import React, { useMemo } from 'react';
import classnames from 'classnames';
import { Icon, Tooltip } from '@/components';

import './index.css';

const SelectorDisplay = ({
  icon,
  innerRef,
  children,
  className,
  highlight,
  border = true,
  displayBgColor = false,
  iconPlacement = 'left',
  tip,
  tipPlacement,
  onClick,
}) => {
  const _className = useMemo(() => {
    return classnames('sea-qa-select custom-select sea-qa-customize-select', 'sea-qa-ai-chat-selector-display', className, {
      'border': border,
      'highlight': highlight,
      'bg-color': displayBgColor,
    });
  }, [className, highlight, border]);

  return (
    <>
      <div
        className={_className}
        ref={innerRef}
        onClick={onClick}
      >
        <div className={classnames('selected-option', `icon-in-${iconPlacement}`)}>
          {icon && iconPlacement === 'left' && (<Icon symbol={icon} />)}
          {children && (<div className="selected-option-show">{children}</div>)}
          {icon && iconPlacement === 'right' && (<Icon symbol={icon} />)}
        </div>
      </div>
      {tip && innerRef && (
        <Tooltip target={innerRef} placement={tipPlacement}>
          {tip}
        </Tooltip>
      )}
    </>
  );
};

export default SelectorDisplay;
