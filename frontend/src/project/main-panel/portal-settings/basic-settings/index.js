import React, { useState, useCallback, useRef } from 'react';
import { Button, FormGroup, Label, Input } from 'reactstrap';
import { CustomizePopover, IconTooltip, SettingsItem, toaster, UploadFile } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { usePortalSettings } from '../hooks';

import './index.css';

const isValidLogoFile = (logoFile) => {
  if (!logoFile) return { error_message: gettext('File invalid!') };
  const maxSizeBytes = 5242880; // 5242880 = 5 * 1024 * 1024
  if (logoFile.size > maxSizeBytes) return { error_message: gettext('The file is too large. Allowed maximum size is 1MB.') };
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedMimeTypes.includes(logoFile.type)) return { error_message: gettext('The file type must be PNG or JPG.') };
  return {};
};

const Main = ({ name: oldName, logo: oldLogo, onChange, onLogoChange }) => {
  const [name, setName] = useState(oldName || '');
  const [logo, setLogo] = useState(oldLogo || '');
  const [isShowLogoPopover, setIsShowLogoPopover] = useState(false);

  const editBtnRef = useRef(null);
  const uploadFileRef = useRef(null);

  const onNameChange = useCallback((event) => {
    const newName = event.target.value;
    if (newName === name) return;
    setName(newName);
  }, [name]);

  const showSystemUpload = useCallback(() => {
    uploadFileRef.current.onClick();
  }, []);

  const handleNameChange = useCallback(() => {
    if (name === oldName) return;
    onChange({ portal_name: name });
  }, [name, oldName, onChange]);

  const handleLogoChange = useCallback((logoFile, logoFileBase64) => {
    const { error_message } = isValidLogoFile(logoFile);
    if (error_message) {
      toaster.danger(error_message);
      return;
    }
    setLogo(logoFileBase64);
    onLogoChange(logoFile, (result) => {
      if (result === false) {
        setLogo(oldLogo || '');
        return;
      }
      if (typeof result === 'string') setLogo(result);
    });
  }, [oldLogo, onLogoChange]);

  const isDefaultLogo = logo === `${mediaUrl}img/portal-logo.png`;
  return (
    <SettingsItem title={gettext('Portal customization')} className="seaqa-portal-basic-settings">
      <FormGroup className="mb-4">
        <Label>{gettext('Portal name')}</Label>
        <Input
          placeholder={gettext('Portal name')}
          className="seaqa-portal-name-settings"
          value={name}
          maxLength={50}
          onChange={onNameChange}
          onBlur={handleNameChange}
        />
      </FormGroup>
      <FormGroup className="mb-4">
        <Label>{gettext('Portal logo')}</Label>
        <div className="portal-basic-settings-logo" ref={editBtnRef}>
          <img src={logo} alt={gettext('Logo')} />
          <IconTooltip
            className="portal-basic-settings-logo-change-btn"
            icon="rename"
            tip={gettext('Change portal logo')}
            onClick={() => setIsShowLogoPopover(true)}
          />
          {isShowLogoPopover && (
            <CustomizePopover
              target={editBtnRef}
              className="seaqa-portal-logo-settings-popover"
              hidePopover={() => setIsShowLogoPopover(false)}
              hidePopoverWithEsc={() => setIsShowLogoPopover(false)}
            >
              <div className="seaqa-portal-logo-settings-popover-container">
                {!isDefaultLogo && (
                  <img src={logo} alt={gettext('Logo')} className="seaqa-portal-logo-settings-popover-logo" />
                )}
                <UploadFile fileType="image/jpeg, image/png, .jpg, .jpeg, .png" onUpload={handleLogoChange} ref={uploadFileRef} />
                <div className="seaqa-tip-default">
                  {gettext('Select a png or jpg image with in 5MB.')}
                </div>
                <div className="seaqa-tip-default">
                  {gettext('Recommended size is 256x256px.')}
                </div>
                <Button color="primary" outline className="seaqa-portal-basic-settings-logo-upload-btn" onClick={showSystemUpload}>
                  {isDefaultLogo ? gettext('Upload logo') : gettext('Change logo')}
                </Button>
              </div>
            </CustomizePopover>
          )}
        </div>
      </FormGroup>
    </SettingsItem>
  );
};

const BasicSettings = () => {
  const { settings, updateSettings, updateLogo } = usePortalSettings();
  return (<Main name={settings?.portal_name} logo={settings?.portal_logo} onChange={updateSettings} onLogoChange={updateLogo} />);
};

export default BasicSettings;
