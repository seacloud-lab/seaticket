import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import { Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import { isHexColor } from '@/utils/color-utils';
import { COLOR_PRESETS } from '../header-background-utils';

import './index.css';

const PortalColorEditor = ({ color, isSelected = false, onChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingColor, setIsEditingColor] = useState(false);
  const [inputColor, setInputColor] = useState(color);

  const onColorInputBlur = () => {
    if (!isHexColor(inputColor)) {
      toaster.danger(gettext('Color is invalid'));
      return;
    }
    onChange(inputColor);
    setIsEditingColor(false);
  };

  return (
    <div className="portal-appearance-color-settings">
      <div className={`portal-appearance-color-preview-wrap d-flex align-items-center ${isSelected ? ' selected' : ''}`}>
        <button
          type="button"
          className="portal-appearance-color-preview"
          style={{ backgroundColor: color }}
          onClick={() => setShowColorPicker(!showColorPicker)}
          aria-label={color}
        />
        {isEditingColor ? (
          <input
            type="text"
            className="form-control portal-appearance-color-input"
            value={inputColor}
            onChange={(event) => setInputColor(event.target.value)}
            onBlur={onColorInputBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onColorInputBlur();
              }
            }}
            autoFocus={true}
          />
        ) : (
          <span
            className="w-100"
            onClick={() => {
              setInputColor(color);
              setIsEditingColor(true);
            }}
          >
            {color}
          </span>
        )}
        {isSelected && (
          <span className="portal-appearance-custom-background-indicator portal-appearance-color-editor-indicator d-flex align-items-center justify-content-center" aria-hidden="true">
            <Icon symbol="check-mark" />
          </span>
        )}
      </div>
      {showColorPicker && (
        <div className="portal-appearance-color-picker">
          <SketchPicker
            color={color}
            presetColors={COLOR_PRESETS}
            disableAlpha={true}
            onChangeComplete={({ hex }) => {
              onChange(hex);
              setShowColorPicker(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PortalColorEditor;
