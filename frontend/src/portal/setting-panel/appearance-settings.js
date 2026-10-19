import React, { useCallback, useRef, useState } from 'react';
import { SketchPicker } from 'react-color';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { CustomizePopover, IconTooltip, toaster, UploadFile, Radio } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { portalAPI } from '@/portal/api';
import { Utils } from '@/utils/utils';

import './appearance-settings.css';

const { projectUuid } = window.app.pageOptions;
const COLOR_PRESETS = ['#f8f1e3', '#fff5ea', '#eef7ff', '#f7f0ff', '#f6fbf5', '#fef7f2', '#f9f7ff', '#f4fbfa'];
const MAX_BACKGROUND_IMAGE_SIZE = 5 * 1024 * 1024;
const BACKGROUND_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const DEFAULT_PORTAL_LOGO = `${mediaUrl}img/portal-logo.png`;

const AppearanceSettings = ({ homePageStyle = {}, setHomePageStyle, updateHomeSetting, portalName, portalLogo, setPortalName, setPortalLogo }) => {
  const heroSection = homePageStyle['portal_home_hero_section'] || {};
  const { background_color = '#f8f1e3', theme_type = 'color', theme_background_image_URL = '' } = heroSection;
  const [name, setName] = useState(portalName || '');
  const [logo, setLogo] = useState(portalLogo || DEFAULT_PORTAL_LOGO);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] = useState(false);
  const [isShowLogoPopover, setIsShowLogoPopover] = useState(false);
  const uploadBackgroundImageRef = useRef(null);
  const editLogoButtonRef = useRef(null);
  const uploadLogoRef = useRef(null);

  const onNameChange = useCallback((event) => {
    setName(event.target.value);
  }, []);

  const saveName = useCallback(() => {
    if (name === portalName) return;
    portalAPI.updateSettings(projectUuid, { portal_name: name }).then(() => {
      setPortalName(name);
    }).catch((error) => {
      setName(portalName || '');
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [name, portalName, setPortalName]);

  const onLogoChange = useCallback((file, base64Logo) => {
    if (!file) {
      toaster.danger(gettext('File invalid!'));
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      toaster.danger(gettext('The file is too large. Allowed maximum size is 1MB.'));
      return;
    }
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toaster.danger(gettext('The file type must be PNG or JPG.'));
      return;
    }

    setLogo(base64Logo);
    portalAPI.uploadPortalLogo(projectUuid, file).then((res) => {
      const newLogo = res.data?.file_url || res.data?.url || '';
      if (!newLogo) throw new Error(gettext('Error'));
      return portalAPI.updateSettings(projectUuid, { portal_logo: newLogo }).then(() => {
        setLogo(newLogo);
        setPortalLogo(newLogo);
      });
    }).catch((error) => {
      setLogo(portalLogo || DEFAULT_PORTAL_LOGO);
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [portalLogo, setPortalLogo]);

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

  const isDefaultLogo = logo === DEFAULT_PORTAL_LOGO;

  return (
    <aside className="portal-appearance-settings">
      <section className="portal-appearance-section">
        <div className="portal-appearance-section-title">{gettext('Portal identity')}</div>
        <FormGroup>
          <Label>{gettext('Portal name')}</Label>
          <Input
            className="portal-setting-input"
            placeholder={gettext('Portal name')}
            value={name}
            maxLength={50}
            onChange={onNameChange}
            onBlur={saveName}
          />
        </FormGroup>
        <FormGroup>
          <Label>{gettext('Portal logo')}</Label>
          <div className="portal-appearance-logo" ref={editLogoButtonRef}>
            <img src={logo} alt={gettext('Logo')} />
            <IconTooltip
              className="portal-appearance-logo-change-button"
              icon="rename"
              tip={gettext('Change portal logo')}
              onClick={() => setIsShowLogoPopover(true)}
            />
            {isShowLogoPopover && (
              <CustomizePopover
                target={editLogoButtonRef}
                className="portal-appearance-logo-popover"
                hidePopover={() => setIsShowLogoPopover(false)}
                hidePopoverWithEsc={() => setIsShowLogoPopover(false)}
              >
                <div className="portal-appearance-logo-popover-content">
                  {!isDefaultLogo && <img src={logo} alt={gettext('Logo')} className="portal-appearance-logo-preview" />}
                  <UploadFile fileType="image/jpeg, image/png, .jpg, .jpeg, .png" onUpload={onLogoChange} ref={uploadLogoRef} />
                  <div className="seaqa-tip-default">{gettext('Select a png or jpg image with in 5MB.')}</div>
                  <div className="seaqa-tip-default">{gettext('Recommended size is 256x256px.')}</div>
                  <Button color="primary" outline className="portal-appearance-logo-upload-button" onClick={() => uploadLogoRef.current?.onClick()}>
                    {isDefaultLogo ? gettext('Upload logo') : gettext('Change logo')}
                  </Button>
                </div>
              </CustomizePopover>
            )}
          </div>
        </FormGroup>
      </section>

      {/* <section className="portal-appearance-section">
        <div className="portal-appearance-section-title">{gettext('Theme color')}</div>
      </section> */}

      <section className="portal-appearance-section">
        <div className="portal-appearance-section-title">{gettext('Header background')}</div>
        <Radio
          isChecked={theme_type === 'color'}
          label={gettext('Use solid color')}
          name="theme_type"
          onCheckedChange={() => updateHomePageStyle({ theme_type: 'color', theme_background_image_URL: '' })}
        />
        {theme_type === 'color' && (
          <div className="portal-appearance-color-settings">
            <div className="portal-appearance-color-preview-wrap">
              <div
                className="portal-appearance-color-preview"
                style={{ backgroundColor: background_color }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              <span className="portal-appearance-color-value">{background_color}</span>
            </div>
            {showColorPicker && (
              <div className="portal-appearance-color-picker">
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
        )}
        <Radio
          isChecked={theme_type === 'image'}
          label={gettext('Use cover image')}
          name="theme_type"
          onCheckedChange={() => updateHomePageStyle({ theme_type: 'image' })}
        />
        {theme_type === 'image' && (
          <div className="portal-appearance-image-settings">
            {theme_background_image_URL && (
              <div
                className="portal-appearance-image-preview"
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
              <Button color="link" className="portal-appearance-image-remove" onClick={clearBackgroundImage}>
                {gettext('Remove image')}
              </Button>
            )}
            <div className="portal-appearance-image-tip">
              {gettext('PNG or JPG, up to 5MB. Recommended size: 1600*300px.')}
            </div>
          </div>
        )}
      </section>
    </aside>
  );
};

export default AppearanceSettings;
