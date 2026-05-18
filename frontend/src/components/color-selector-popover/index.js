import React, { useCallback } from 'react';
import { SELECT_OPTION_COLORS } from '../../constants';
import CustomizePopover from '../customize-popover';
import IconButton from '../icon-button';

import './index.css';

const ColorSelectorPopover = ({ target, onToggle, color, onChange }) => {

  const onClick = useCallback((event, colorOption) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const newColor = colorOption.COLOR;
    if (newColor !== color) {
      onChange(colorOption);
    }
    onToggle();
  }, [color, onChange, onToggle]);

  return (
    <CustomizePopover
      target={target}
      className="seaqa-color-selector-popover"
      hidePopover={onToggle}
      hidePopoverWithEsc={onToggle}
    >
      <div className="seaqa-color-selector-container" onMouseDown={(e) => e && e.stopPropagation()}>
        {SELECT_OPTION_COLORS.map((option) => {
          const { COLOR: optionColor, BORDER_COLOR: borderColor, TEXT_COLOR: textColor } = option;
          return (
            <IconButton
              key={optionColor}
              className="colorinput-color"
              style={{ backgroundColor: optionColor, borderColor: borderColor, color: textColor }}
              icon={optionColor === color ? 'arrow-down-b' : null}
              onClick={(event) => onClick(event, option)}
            />
          );
        })}
      </div>
    </CustomizePopover>
  );
};

export default ColorSelectorPopover;
