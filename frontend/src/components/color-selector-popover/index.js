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
      className="sea-qa-color-selector-popover"
      hidePopover={onToggle}
      hidePopoverWithEsc={onToggle}
    >
      <div className="row gutters-xs" onMouseDown={(e) => e && e.stopPropagation()}>
        {SELECT_OPTION_COLORS.map((option) => {
          const { COLOR: optionColor, BORDER_COLOR: borderColor, TEXT_COLOR: textColor } = option;
          return (
            <div key={option.COLOR} className="col-auto">
              <label className="colorinput">
                <input
                  name="color"
                  type="radio"
                  value={optionColor}
                  className="colorinput-input"
                  checked={optionColor === color}
                  onClick={(event) => onClick(event, option)}
                />
                <IconButton
                  className="colorinput-color"
                  style={{ backgroundColor: optionColor, borderColor: borderColor, color: textColor }}
                  icon={optionColor === color ? 'check-mark' : null}
                />
              </label>
            </div>
          );
        })}
      </div>
    </CustomizePopover>
  );
};

export default ColorSelectorPopover;
