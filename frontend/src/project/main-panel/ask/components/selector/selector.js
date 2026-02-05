import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { OptionEditor } from '@/components';
import SelectorDisplay from './selector-display';

import './index.css';

const Selector = ({
  value,
  options,
  onChange,
  className,
  isSearchEnabled,
  border,
  icon,
  displayBgColor,
  iconPlacement,
  children,
}) => {
  const [isShowMenu, setIsShowMenu] = useState(false);

  const ref = useRef(null);

  const handleChange = useCallback((newValue) => {
    if (value !== newValue) {
      onChange(newValue);
    }
    setIsShowMenu(false);
  }, [value, onChange]);

  const onMenuToggle = useCallback(() => {
    setIsShowMenu(true);
  }, []);

  return (
    <>
      <SelectorDisplay
        innerRef={ref}
        onClick={onMenuToggle}
        className={classnames('o-hidden', className)}
        icon={icon}
        iconPlacement={iconPlacement}
        border={border}
        displayBgColor={displayBgColor}
      >
        {children}
      </SelectorDisplay>
      {isShowMenu && (
        <OptionEditor
          className="sea-qa-ai-chat-selector-display-editor "
          options={options}
          target={ref}
          isSearchEnabled={isSearchEnabled}
          value={value}
          onChange={handleChange}
          onToggle={() => setIsShowMenu(false)}
        />
      )}
    </>
  );
};

export default Selector;
