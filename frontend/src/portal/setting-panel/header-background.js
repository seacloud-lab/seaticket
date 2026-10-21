import React, { useCallback, useRef, useState } from 'react';
import { Icon, toaster, UploadFile, Switch } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '@/portal/api';
import { getAutoBackgroundColor } from '@/portal/color-utils';
import PortalColorEditor from '@/portal/setting-panel/portal-color-editor';
import { Utils } from '@/utils/utils';
import { BACKGROUND_IMAGE_TYPES, MAX_BACKGROUND_IMAGE_SIZE } from './header-background-utils';

import './header-background.css';

const { projectUuid } = window.app.pageOptions;

const HeaderBackground = ({ homePageStyle, portalThemeColor, updateHomePageStyle }) => {
  const heroSection = homePageStyle['portal_home_hero_section'] || {};
  const { background_color = '#f8f1e3', theme_type = 'color', theme_background_image_URL = '', match_theme_color = false } = heroSection;
  const autoBackgroundColor = getAutoBackgroundColor(portalThemeColor);
  const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] = useState(false);
  const uploadBackgroundImageRef = useRef(null);

  const updateHeaderBackgroundColor = useCallback((color) => {
    updateHomePageStyle({ background_color: color });
  }, [updateHomePageStyle]);

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
    <section className="portal-appearance-section p-4 mb-6">
      <div className="portal-appearance-section-title">{gettext('Header background')}</div>
      <Switch
        className="portal-appearance-match-theme-color d-flex align-items-center mt-1 mb-2"
        checked={match_theme_color}
        placeholder={gettext('Match theme color')}
        fontWeight={400}
        onChange={(event) => updateHomePageStyle({ match_theme_color: event.target.checked })}
      />

      {match_theme_color && (
        <div className="portal-appearance-auto-background-color">
          <div className="portal-appearance-auto-background-color-label mb-2">
            {gettext('Auto-generated background color')}
          </div>
          <div className="portal-appearance-auto-background-color-preview d-flex align-items-center">
            <span className="portal-appearance-auto-background-color-swatch" style={{ backgroundColor: autoBackgroundColor }} />
            <span>{autoBackgroundColor}</span>
          </div>
        </div>
      )}

      {!match_theme_color && (
        <>
          <div className="portal-appearance-custom-background-title">{gettext('Custom background')}</div>
          <div className="portal-appearance-custom-background-options d-flex gap-2 mb-3" role="radiogroup" aria-label={gettext('Custom background')}>
            <button
              type="button"
              className={`portal-appearance-custom-background-option d-flex align-items-center justify-content-between${theme_type === 'color' ? ' selected' : ''}`}
              role="radio"
              aria-checked={theme_type === 'color'}
              onClick={() => updateHomePageStyle({ theme_type: 'color', theme_background_image_URL: '' })}
            >
              <span>{gettext('Color')}</span>
              <span className="portal-appearance-custom-background-indicator d-flex align-items-center justify-content-center" aria-hidden="true">
                {theme_type === 'color' && <Icon symbol="check-mark" />}
              </span>
            </button>
            <button
              type="button"
              className={`portal-appearance-custom-background-option d-flex align-items-center justify-content-between${theme_type === 'image' ? ' selected' : ''}`}
              role="radio"
              aria-checked={theme_type === 'image'}
              onClick={() => updateHomePageStyle({ theme_type: 'image' })}
            >
              <span>{gettext('Image')}</span>
              <span className="portal-appearance-custom-background-indicator d-flex align-items-center justify-content-center" aria-hidden="true">
                {theme_type === 'image' && <Icon symbol="check-mark" />}
              </span>
            </button>
          </div>

          {theme_type === 'color' && (
            <>
              <div className="portal-appearance-custom-background-title">{gettext('Custom background')}</div>
              <PortalColorEditor color={background_color} onChange={updateHeaderBackgroundColor} />
            </>
          )}

          {theme_type === 'image' && (
            <div className="portal-appearance-image-settings d-flex flex-column align-items-start gap-2">
              <UploadFile
                fileType="image/jpeg, image/png, .jpg, .jpeg, .png"
                onUpload={onBackgroundImageUpload}
                ref={uploadBackgroundImageRef}
              />
              {theme_background_image_URL ? (
                <div
                  className="portal-appearance-image-preview"
                  style={{ backgroundImage: `url(${theme_background_image_URL})` }}
                  role="img"
                  aria-label={gettext('Background image preview')}
                >
                  <div className="portal-appearance-image-actions d-flex align-items-center justify-content-center gap-2">
                    <button
                      type="button"
                      className="portal-appearance-image-action d-flex align-items-center justify-content-center"
                      onClick={showBackgroundImageUpload}
                      disabled={isUploadingBackgroundImage}
                      title={gettext('Edit image')}
                      aria-label={gettext('Edit image')}
                    >
                      <Icon symbol="edit" />
                    </button>
                    <button
                      type="button"
                      className="portal-appearance-image-action d-flex align-items-center justify-content-center"
                      onClick={clearBackgroundImage}
                      disabled={isUploadingBackgroundImage}
                      title={gettext('Remove image')}
                      aria-label={gettext('Remove image')}
                    >
                      <Icon symbol="delete" />
                    </button>
                  </div>
                  {isUploadingBackgroundImage && <span className="portal-appearance-image-uploading d-flex align-items-center justify-content-center">{gettext('Uploading...')}</span>}
                </div>
              ) : (
                <button
                  type="button"
                  className="portal-appearance-image-upload d-flex align-items-center justify-content-center gap-2"
                  onClick={showBackgroundImageUpload}
                  disabled={isUploadingBackgroundImage}
                >
                  {isUploadingBackgroundImage ? gettext('Uploading...') : <><Icon symbol="plus" />{gettext('Upload image')}</>}
                </button>
              )}
              <div className="portal-appearance-image-tip d-flex flex-column">
                <span>{gettext('PNG or JPG, up to 5 MB')}</span>
                <span>{gettext('Recommended size: 1600 x 300 px')}</span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default HeaderBackground;
