import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Label, Input } from 'reactstrap';
import { SketchPicker } from 'react-color';
import { gettext } from '@/constants';
import CustomizeSelect from '@/components/customize-select';
import Radio from '@/components/radio';
import { IconButton, toaster, UploadFile } from '@/components';

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

const MAX_BACKGROUND_IMAGE_SIZE = 5 * 1024 * 1024;
const BACKGROUND_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const PortalHomeEditPanel = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting, onClose }) => {
  const { titleText = gettext('Hey 👋, how can we help?'), descriptionText = gettext('Chat with AI'), titleSize = 48, backgroundColor = '#f8f1e3', cardLayout = 3, themeType = 'color', themeBackgroundImageURL = '' } = homePageStyle;
  const [showColorPicker, setShowColorPicker] = useState(false);
  const uploadBackgroundImageRef = useRef(null);

  const titleSizeValue = useMemo(() => {
    return TITLE_SIZE_OPTIONS.find(option => option.value === titleSize) || TITLE_SIZE_OPTIONS[0];
  }, [titleSize]);

  const cardLayoutValue = useMemo(() => {
    return CARD_LAYOUT_OPTIONS.find(option => option.value === cardLayout) || CARD_LAYOUT_OPTIONS[1];
  }, [cardLayout]);

  const updateHomePageStyle = useCallback((patch) => {
    setHomePageStyle((prev) => {
      const next = { ...prev, ...patch };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  }, [setHomePageStyle, updateHomeSetting]);

  const onBackgroundImageUpload = useCallback((image, imageBase64) => {
    if (!image) return;
    if (image.size > MAX_BACKGROUND_IMAGE_SIZE) {
      toaster.danger(gettext('The image is too large. Allowed maximum size is 5MB.'));
      return;
    }
    if (!BACKGROUND_IMAGE_TYPES.includes(image.type)) {
      toaster.danger(gettext('The image type must be PNG or JPG.'));
      return;
    }
    updateHomePageStyle({ themeBackgroundImageURL: imageBase64, themeType: 'image' });
  }, [updateHomePageStyle]);

  const showBackgroundImageUpload = useCallback(() => {
    uploadBackgroundImageRef.current?.onClick();
  }, []);

  const clearBackgroundImage = useCallback(() => {
    updateHomePageStyle({ themeBackgroundImageURL: '' });
  }, [updateHomePageStyle]);

  return (
    <aside className="portal-home-edit-panel">
      <div className="portal-home-edit-panel-header">
        <div className="portal-home-edit-panel-header-left" />
        <div className="portal-home-edit-panel-title">{gettext('Page settings')}</div>
        <IconButton
          icon="close"
          onClick={onClose}
          title={gettext('Close')}
          aria-label={gettext('Close')}
        />
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
        <Label>{gettext('Header background')}</Label>
        <Radio
          isChecked={themeType === 'color'}
          label={gettext('Use solid color')}
          name="themeType"
          onCheckedChange={() => updateHomePageStyle({ themeType: 'color', themeBackgroundImageURL: '' })}
        />
        {themeType === 'color' &&
          <div className="portal-home-edit-panel-section">
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
        }
        <Radio
          isChecked={themeType === 'image'}
          label={gettext('Use cover image')}
          name="themeType"
          onCheckedChange={() => updateHomePageStyle({ themeType: 'image' })}
        />
        {themeType === 'image' &&
          <div className="portal-home-edit-panel-image-settings">
            {themeBackgroundImageURL && (
              <div
                className="portal-home-edit-panel-image-preview"
                style={{ backgroundImage: `url(${themeBackgroundImageURL})` }}
                role="img"
                aria-label={gettext('Background image preview')}
              />
            )}
            <UploadFile
              fileType="image/jpeg, image/png, .jpg, .jpeg, .png"
              onUpload={onBackgroundImageUpload}
              ref={uploadBackgroundImageRef}
            />
            <Button color="primary" outline size="sm" onClick={showBackgroundImageUpload}>
              {themeBackgroundImageURL ? gettext('Change image') : gettext('Upload custom image')}
            </Button>
            {themeBackgroundImageURL && (
              <Button color="link" className="portal-home-edit-panel-image-remove" onClick={clearBackgroundImage}>
                {gettext('Remove image')}
              </Button>
            )}
            <div className="portal-home-edit-panel-image-tip">
              {gettext('PNG or JPG, up to 5MB. Recommended size: 1600*300px.')}
            </div>
          </div>
        }
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
