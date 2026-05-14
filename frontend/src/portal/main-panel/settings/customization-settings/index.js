import React, { useState, useCallback, useMemo, useRef } from 'react';
import { TabPane, Button, FormGroup, Label, Input } from 'reactstrap';
import { gettext, mediaUrl } from '@/constants';
import { SETTING_TAB } from '../constants';
import { CustomizePopover, IconTooltip, Loading, toaster, UploadFile } from '@/components';
import { usePortalSettings } from '@/portal/hooks';

import './index.css';

const isValidLogoFile = (logoFile) => {
  if (!logoFile) return { error_message: gettext('File invalid!') };
  const maxSizeBytes = 5242880; // 5242880 = 5 * 1024 * 1024
  if (logoFile.size > maxSizeBytes) return { error_message: gettext('The file is too large. Allowed maximum size is 1MB.') };
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedMimeTypes.includes(logoFile.type)) return { error_message: gettext('The file type must be PNG or JPG.') };
  return {};
};

const Main = ({ name: oldName, logo: oldLogo }) => {
  const [name, setName] = useState(oldName || '');
  const [logo, setLogo] = useState(oldLogo || '');
  const [isShowLogoPopover, setIsShowLogoPopover] = useState(false);

  const { isUploadingLogo, isUpdatingNameOrLogo, updateNameOrLogo } = usePortalSettings();

  const editBtnRef = useRef(null);
  const uploadFileRef = useRef(null);
  const nextLogo = useRef(null);

  const isChanged = useMemo(() => {
    return name !== oldName || oldLogo !== logo;
  }, [name, oldName, logo, oldLogo]);

  const onNameChange = useCallback((event) => {
    const newName = event.target.value;
    if (newName === name) return;
    setName(newName);
  }, [name]);

  const showSystemUpload = useCallback(() => {
    uploadFileRef.current.onClick();
  }, []);

  const onLogoChange = useCallback((logoFile, logoFileBase64) => {
    const { error_message } = isValidLogoFile(logoFile);
    if (error_message) {
      toaster.danger(error_message);
      return;
    }
    nextLogo.current = logoFile;
    setLogo(logoFileBase64);
  }, []);

  const reset = useCallback(() => {
    setName(oldName);
    setLogo(oldLogo);
  }, [oldName, oldLogo]);

  const handleChange = useCallback(() => {
    let update = {};
    if (oldName !== name) {
      update['name'] = name;
    }
    if (oldLogo !== logo) {
      update['logo'] = nextLogo.current;
    }
    updateNameOrLogo(update, (serverData) => {
      nextLogo.current = null;
      setLogo(serverData?.portal_logo || logo);
      setName(serverData?.portal_name || name);
    });
  }, [logo, name, oldName, oldLogo, updateNameOrLogo]);

  const isDefaultLogo = logo === `${mediaUrl}img/portal-logo.png`;

  return (
    <TabPane tabId={SETTING_TAB.PORTAL_CUSTOMIZATION} className="portal-customization-settings">
      <div className="portal-customization-settings-body">
        <FormGroup className="mb-5">
          <Label>{gettext('Portal name')}</Label>
          <Input
            placeholder={gettext('Portal name')}
            value={name}
            maxLength={50}
            disabled={isUploadingLogo || isUpdatingNameOrLogo}
            onChange={onNameChange}
          />
        </FormGroup>
        <FormGroup className="mb-5">
          <Label>{gettext('Portal logo')}</Label>
          <div className="portal-customization-settings-logo" ref={editBtnRef}>
            <img src={logo} alt={gettext('Logo')} />
            {!(isUploadingLogo || isUpdatingNameOrLogo) && (
              <IconTooltip
                className="portal-customization-settings-logo-change-btn"
                icon="rename"
                tip={gettext('Change portal logo')}
                onClick={() => setIsShowLogoPopover(true)}
              />
            )}
            {isShowLogoPopover && (
              <CustomizePopover
                target={editBtnRef}
                className="portal-customization-settings-logo-popover"
                hidePopover={() => setIsShowLogoPopover(false)}
                hidePopoverWithEsc={() => setIsShowLogoPopover(false)}
              >
                <div className="portal-customization-settings-logo-popover-container">
                  {!isDefaultLogo && (
                    <img src={logo} alt={gettext('Logo')} className="portal-customization-settings-logo-popover-logo" />
                  )}
                  <UploadFile fileType="image/jpeg, image/png, .jpg, .jpeg, .png" onUpload={onLogoChange} ref={uploadFileRef} />
                  <div className="sea-qa-tip-default">
                    {gettext('Select a png or jpg image with in 5MB.')}
                  </div>
                  <div className="sea-qa-tip-default">
                    {gettext('Recommended size is 156x256px.')}
                  </div>
                  <Button color="primary" outline className="portal-customization-settings-logo-upload-btn" onClick={showSystemUpload}>
                    {isDefaultLogo ? gettext('Upload logo') : gettext('Change logo')}
                  </Button>
                </div>
              </CustomizePopover>
            )}
          </div>
        </FormGroup>
      </div>
      <div className="portal-customization-settings-footer">
        <Button onClick={reset} disabled={isUploadingLogo || isUpdatingNameOrLogo || !isChanged }>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleChange} disabled={!isChanged || !name || isUploadingLogo || isUpdatingNameOrLogo}>
          {(isUploadingLogo || isUpdatingNameOrLogo) ? (<Loading />) : (<>{gettext('Save')}</>)}
        </Button>
      </div>
    </TabPane>
  );
};

const CustomizationSettings = () => {
  const { name, logo } = usePortalSettings();
  return (<Main name={name} logo={logo}/>);
};

export default CustomizationSettings;
