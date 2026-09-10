import React, { useCallback, useRef, useState } from 'react';
import { SketchPicker } from 'react-color';
import { Button, Label, Input } from 'reactstrap';
import { IconButton, toaster, UploadFile, CustomizeSelect, Radio } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import { Utils } from '@/utils/utils';

import './edit-panel.css';

const { projectUuid } = window.app.pageOptions;

const TITLE_SIZE_OPTIONS = [32, 40, 48, 56, 64, 72].map((size) => ({
  value: size,
  name: `${size}px`,
  label: `${size}px`,
}));

const COLOR_PRESETS = ['#f8f1e3', '#fff5ea', '#eef7ff', '#f7f0ff', '#f6fbf5', '#fef7f2', '#f9f7ff', '#f4fbfa'];

const CARD_LAYOUT_OPTIONS = [2, 3, 4, 5, 6].map((count) => ({
  value: count,
  name: count + '',
  label: count + '',
}));

const MAX_BACKGROUND_IMAGE_SIZE = 5 * 1024 * 1024;
const BACKGROUND_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const PortalHomeEditPanel = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting, onClose }) => {
  const heroSection = homePageStyle['portal_home_hero_section'] || {};
  const cardsSection = homePageStyle['portal_home_cards_section'] || {};
  const { title_text = gettext('Hey 👋, how can we help?'), description_text = gettext('Chat with AI'), title_size = 48, background_color = '#f8f1e3', theme_type = 'color', theme_background_image_URL = '' } = heroSection;
  const { card_layout = 3 } = cardsSection;
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] = useState(false);
  const uploadBackgroundImageRef = useRef(null);

  const updateHomePageStyle = useCallback((patch) => {
    setHomePageStyle((prev) => {
      const next = {
        ...prev,
        'portal_home_hero_section': {
          ...prev['portal_home_hero_section'],
          ...patch,
        },
      };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  }, [setHomePageStyle, updateHomeSetting]);

  const updateCardsSection = (patch) => {
    setHomePageStyle((prev) => {
      const next = {
        ...prev,
        'portal_home_cards_section': {
          ...prev['portal_home_cards_section'],
          ...patch,
        },
      };
      updateHomeSetting(JSON.stringify(next));
      return next;
    });
  };

  const onBackgroundImageUpload = useCallback((image) => {
    if (!image) return;
    if (image.size > MAX_BACKGROUND_IMAGE_SIZE) {
      toaster.danger(gettext('The image is too large. Allowed maximum size is 5MB.'));
      return;
    }
    if (!BACKGROUND_IMAGE_TYPES.includes(image.type)) {
      toaster.danger(gettext('The image type must be PNG or JPG.'));
      return;
    }
    setIsUploadingBackgroundImage(true);
    portalAPI.uploadPortalBackgroundImage(projectUuid, image)
      .then((res) => {
        const imageURL = res.data?.file_url || res.data?.url;
        if (!imageURL) {
          throw new Error(gettext('Failed to get uploaded image URL'));
        }
        updateHomePageStyle({ theme_background_image_URL: imageURL, theme_type: 'image' });
      })
      .catch((error) => {
        toaster.danger(Utils.getErrorMsg(error));
      })
      .finally(() => {
        setIsUploadingBackgroundImage(false);
      });
  }, [updateHomePageStyle]);

  const showBackgroundImageUpload = useCallback(() => {
    uploadBackgroundImageRef.current?.onClick();
  }, []);

  const clearBackgroundImage = useCallback(() => {
    updateHomePageStyle({ theme_background_image_URL: '' });
  }, [updateHomePageStyle]);

  return (
    <aside className="portal-home-edit-panel">
      <div className="portal-home-edit-panel-header">
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
          value={title_text}
          onChange={(e) => updateHomePageStyle({ title_text: e.target.value })}
          placeholder={gettext('Enter title')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Title size')}</Label>
        <CustomizeSelect
          value={title_size || TITLE_SIZE_OPTIONS[0].value}
          options={TITLE_SIZE_OPTIONS}
          onChange={(value) => updateHomePageStyle({ title_size: value })}
          placeholder={gettext('Select size')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Chat placeholder')}</Label>
        <Input
          className="portal-home-edit-panel-input"
          type="text"
          value={description_text}
          onChange={(e) => updateHomePageStyle({ description_text: e.target.value })}
          placeholder={gettext('Enter description')}
        />
      </div>

      <div className="portal-home-edit-panel-section">
        <Label>{gettext('Header background')}</Label>
        <Radio
          isChecked={theme_type === 'color'}
          label={gettext('Use solid color')}
          name="theme_type"
          onCheckedChange={() => updateHomePageStyle({ theme_type: 'color', theme_background_image_URL: '' })}
        />
        {theme_type === 'color' &&
          <div className="portal-home-edit-panel-section">
            <div className="portal-home-edit-panel-color-preview-wrap">
              <div
                className="portal-home-edit-panel-color-preview"
                style={{ backgroundColor: background_color }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              <span className="portal-home-edit-panel-color-value">{background_color}</span>
            </div>
            {showColorPicker && (
              <div className="portal-home-edit-panel-color-picker">
                <SketchPicker
                  color={background_color}
                  presetColors={COLOR_PRESETS}
                  disableAlpha={true}
                  onChangeComplete={(color) => {
                    updateHomePageStyle({ background_color: color.hex });
                    setShowColorPicker(!showColorPicker);
                  }}
                />
              </div>
            )}
          </div>
        }
        <Radio
          isChecked={theme_type === 'image'}
          label={gettext('Use cover image')}
          name="theme_type"
          onCheckedChange={() => updateHomePageStyle({ theme_type: 'image' })}
        />
        {theme_type === 'image' &&
          <div className="portal-home-edit-panel-image-settings">
            {theme_background_image_URL && (
              <div
                className="portal-home-edit-panel-image-preview"
                style={{ backgroundImage: `url(${theme_background_image_URL})` }}
                role="img"
                aria-label={gettext('Background image preview')}
              />
            )}
            <UploadFile
              fileType="image/jpeg, image/png, .jpg, .jpeg, .png"
              onUpload={onBackgroundImageUpload}
              ref={uploadBackgroundImageRef}
            />
            <Button color="primary" outline size="sm" onClick={showBackgroundImageUpload} disabled={isUploadingBackgroundImage}>
              {isUploadingBackgroundImage
                ? gettext('Uploading...')
                : (theme_background_image_URL ? gettext('Change image') : gettext('Upload custom image'))}
            </Button>
            {theme_background_image_URL && !isUploadingBackgroundImage && (
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
          value={card_layout || CARD_LAYOUT_OPTIONS[0].value}
          options={CARD_LAYOUT_OPTIONS}
          onChange={(value) => updateCardsSection({ card_layout: value })}
          placeholder={gettext('Select layout')}
          searchable={false}
        />
      </div>
    </aside>
  );
};

export default PortalHomeEditPanel;
