import React, { useMemo, useState } from 'react';
import { Label, Input } from 'reactstrap';
import { SketchPicker } from 'react-color';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import CustomizeSelect from '@/components/customize-select';

import './edit-panel.css';

const TITLE_SIZE_OPTIONS = [32, 40, 48, 56, 64, 72].map((size) => ({
  value: size,
  name: `${size}px`,
  label: <span>{`${size}px`}</span>,
}));

const COLOR_PRESETS = ['#f8f1e3', '#fff5ea', '#eef7ff', '#f7f0ff', '#f6fbf5', '#fef7f2', '#f9f7ff', '#f4fbfa'];

const CARD_LAYOUT_OPTIONS = [2, 3, 4, 5, 6].map((count) => ({
  value: count,
  name: `${count}`,
  label: <span>{`${count}`}</span>,
}));

const PortalHomeEditPanel = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting, onClose }) => {
  const { titleText = gettext('Hey 👋, how can we help?'), descriptionText = gettext('Chat with AI'), titleSize = 48, backgroundColor = '#f8f1e3', cardLayout = 3 } = homePageStyle;
  const [showColorPicker, setShowColorPicker] = useState(false);

  const titleSizeValue = useMemo(() => {
    return TITLE_SIZE_OPTIONS.find(option => option.value === titleSize) || TITLE_SIZE_OPTIONS[0];
  }, [titleSize]);

  const cardLayoutValue = useMemo(() => {
    return CARD_LAYOUT_OPTIONS.find(option => option.value === cardLayout) || CARD_LAYOUT_OPTIONS[1];
  }, [cardLayout]);

  const updateHomePageStyle = (patch) => {
    setHomePageStyle((prev) => {
      const next = { ...prev, ...patch };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  };

  return (
    <aside className="portal-home-edit-panel">
      <div className="portal-home-edit-panel-header">
        <div className="portal-home-edit-panel-header-left" />
        <div className="portal-home-edit-panel-title">{gettext('Page setting')}</div>
        <span className="portal-home-edit-panel-close" onClick={onClose} role="button" tabIndex={0}>
          <Icon symbol="close" className="portal-home-edit-panel-close-icon" />
        </span>
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Title')}</Label>
        <Input
          className="portal-home-edit-panel-input"
          type="text"
          value={titleText}
          onChange={(e) => updateHomePageStyle({ titleText: e.target.value })}
          placeholder={gettext('Enter title')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Title size')}</Label>
        <CustomizeSelect
          value={titleSizeValue}
          options={TITLE_SIZE_OPTIONS}
          onChange={(value) => updateHomePageStyle({ titleSize: value })}
          placeholder={gettext('Select size')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Chat placeholder')}</Label>
        <Input
          className="portal-home-edit-panel-input"
          type="text"
          value={descriptionText}
          onChange={(e) => updateHomePageStyle({ descriptionText: e.target.value })}
          placeholder={gettext('Enter description')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Background color')}</Label>
        <div className="portal-home-edit-panel-color-preview-wrap">
          <div
            className="portal-home-edit-panel-color-preview"
            style={{ backgroundColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
          />
          <span className="portal-home-edit-panel-color-value">{backgroundColor}</span>
        </div>
        {showColorPicker && (
          <div className="portal-home-edit-panel-color-picker">
            <SketchPicker
              color={backgroundColor}
              presetColors={COLOR_PRESETS}
              disableAlpha={true}
              onChangeComplete={(color) => {
                updateHomePageStyle({ backgroundColor: color.hex });
                setShowColorPicker(!showColorPicker);
              }}
            />
          </div>
        )}
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Card layout')}</Label>
        <CustomizeSelect
          value={cardLayoutValue}
          options={CARD_LAYOUT_OPTIONS}
          onChange={(value) => updateHomePageStyle({ cardLayout: value })}
          placeholder={gettext('Select layout')}
          searchable={false}
        />
      </div>
    </aside>
  );
};

export default PortalHomeEditPanel;
