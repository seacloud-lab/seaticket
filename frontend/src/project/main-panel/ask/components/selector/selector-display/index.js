import React, { useMemo } from 'react';
import classnames from 'classnames';
import { Icon } from '@/components';

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
    <div
      className={_className}
      ref={innerRef}
      onClick={onClick}
    >
      <div className={classnames('selected-option', `icon-in-${iconPlacement}`)}>
        {icon && iconPlacement === 'left' && (<Icon symbol={icon} />)}
        <div className="selected-option-show">{children}</div>
        {icon && iconPlacement === 'right' && (<Icon symbol={icon} />)}
      </div>
    </div>
  );
};

export default SelectorDisplay;
