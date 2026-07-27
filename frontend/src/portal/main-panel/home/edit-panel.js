import React, { useMemo, useState } from 'react';
import { Label, Input } from 'reactstrap';
import { SketchPicker } from 'react-color';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import CustomizeSelect from '@/components/customize-select';

import './edit-panel.css';

const TITLE_SIZE_OPTIONS = [18, 20, 24, 28, 32, 36].map((size) => ({
  value: size,
  name: `${size}px`,
  label: <span>{`${size}px`}</span>,
}));

const COLOR_PRESET_OPTIONS = [
  { value: '#f8f1e3', name: '#f8f1e3', label: <span>#f8f1e3</span> },
  { value: '#fff5ea', name: '#fff5ea', label: <span>#fff5ea</span> },
  { value: '#eef7ff', name: '#eef7ff', label: <span>#eef7ff</span> },
  { value: '#f7f0ff', name: '#f7f0ff', label: <span>#f7f0ff</span> },
  { value: '#f6fbf5', name: '#f6fbf5', label: <span>#f6fbf5</span> },
];

const PortalHomeEditPanel = ({ homePageStyle = {}, setHomePageStyle, onClose }) => {
  const { titleText = gettext('Hey 👋, how can we help?'), descriptionText = gettext('Chat with AI'), titleSize = 24, backgroundColor = '#f8f1e3' } = homePageStyle;
  const [showColorPicker, setShowColorPicker] = useState(false);

  const titleSizeValue = useMemo(() => {
    return TITLE_SIZE_OPTIONS.find(option => option.value === titleSize) || TITLE_SIZE_OPTIONS[2];
  }, [titleSize]);

  const updateHomePageStyle = (patch) => {
    setHomePageStyle((prev) => ({ ...prev, ...patch }));
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
          onChange={(option) => updateHomePageStyle({ titleSize: option.value })}
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
        <CustomizeSelect
          value={{ value: backgroundColor, name: backgroundColor, label: <span>{backgroundColor}</span> }}
          options={COLOR_PRESET_OPTIONS}
          onChange={(option) => updateHomePageStyle({ backgroundColor: option.value })}
          placeholder={gettext('Select color')}
          searchable={false}
        />
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
              presetColors={['#f8f1e3', '#fff5ea', '#eef7ff', '#f7f0ff', '#f6fbf5']}
              disableAlpha={true}
              onChangeComplete={(color) => updateHomePageStyle({ backgroundColor: color.hex })}
            />
          </div>
        )}
      </div>
    </aside>
  );
};

export default PortalHomeEditPanel;
