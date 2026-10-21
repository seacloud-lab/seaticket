import React, { useCallback, useRef, useState } from 'react';
import { Button, Input, Label } from 'reactstrap';
import { CustomizePopover, IconTooltip, toaster, UploadFile } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { portalAPI } from '@/portal/api';
import { Utils } from '@/utils/utils';

import './portal-identity.css';

const { projectUuid } = window.app.pageOptions;
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const DEFAULT_PORTAL_LOGO = `${mediaUrl}img/portal-logo.png`;

const PortalIdentity = ({ portalName, portalLogo, setPortalName, setPortalLogo }) => {
  const [name, setName] = useState(portalName || '');
  const [logo, setLogo] = useState(portalLogo || DEFAULT_PORTAL_LOGO);
  const [isShowLogoPopover, setIsShowLogoPopover] = useState(false);
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
    if (file.size > MAX_LOGO_SIZE) {
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

  const isDefaultLogo = logo === DEFAULT_PORTAL_LOGO;

  return (
    <section className="portal-appearance-section p-4">
      <div className="portal-appearance-section-title mb-3">{gettext('Portal identity')}</div>
      <div className="mb-4">
        <Label>{gettext('Portal name')}</Label>
        <Input
          className="portal-setting-input"
          placeholder={gettext('Portal name')}
          value={name}
          maxLength={50}
          onChange={onNameChange}
          onBlur={saveName}
        />
      </div>
      <div>
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
              <div className="portal-appearance-logo-popover-content d-flex flex-column align-items-center justify-content-center">
                {!isDefaultLogo && <img src={logo} alt={gettext('Logo')} className="portal-appearance-logo-preview mb-4" />}
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
      </div>
    </section>
  );
};

export default PortalIdentity;
