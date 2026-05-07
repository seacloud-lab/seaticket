import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, ModalBody, Button } from 'reactstrap';
import CustomModalHeader from '../../components/modal-header';
import { toaster } from '@/components';
import { gettext } from '@/constants';
import { portalAPI } from '../api';

import './portal-customization-dialog.css';

const { projectUuid } = window.app.pageOptions;

const PortalCustomizationDialog = ({ toggle, portalName, portalLogo, onUpdate }) => {
  const [name, setName] = useState(portalName || '');
  const [logoUrl, setLogoUrl] = useState(portalLogo || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(portalName || '');
    setLogoUrl(portalLogo || '');
  }, [portalName, portalLogo]);

  const openFileInput = useCallback(() => {
    fileInputRef.current && fileInputRef.current.click();
  }, []);

  const onFileChange = useCallback(async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toaster.danger(gettext('Please upload an image file'));
      return;
    }

    setIsUploading(true);
    try {
      const res = await portalAPI.uploadPortalLogo(projectUuid, file);
      const uploadedUrl = res.data?.file_url || res.data?.url || '';
      if (uploadedUrl) {
        setLogoUrl(uploadedUrl);
      } else {
        toaster.danger(gettext('Upload failed'));
      }
    } catch (error) {
      const serverMessage = error.response?.data?.error_msg;
      if (serverMessage) {
        toaster.danger(serverMessage);
      } else {
        toaster.danger(gettext('Upload failed'));
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const onNameChange = useCallback((e) => {
    setName(e.target.value);
  }, []);

  const onSave = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);

    portalAPI.updateSettings(projectUuid, {
      portal_name: name,
      portal_logo: logoUrl,
    }).then(() => {
      window.app.pageOptions.portalName = name;
      window.app.pageOptions.portalLogo = logoUrl;
      onUpdate(name, logoUrl);
      toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
      toggle();
    }).catch((error) => {
      toaster.danger(gettext('Save failed'));
    }).finally(() => {
      setIsSaving(false);
    });
  }, [name, logoUrl, isSaving, toggle, onUpdate]);

  const onRemoveLogo = useCallback(() => {
    setLogoUrl('');
  }, []);

  return (
    <Modal isOpen={true} toggle={toggle} className="portal-customization-dialog">
      <CustomModalHeader toggle={toggle}>{gettext('Portal customization')}</CustomModalHeader>
      <ModalBody>
        <div className="portal-customization-content">
          <div className="portal-customization-section">
            <label className="portal-customization-label">{gettext('Logo')}</label>
            <div className="portal-customization-logo-area">
              {logoUrl ? (
                <div className="portal-customization-logo-preview">
                  <img src={logoUrl} alt="" />
                </div>
              ) : (
                <div className="portal-customization-logo-placeholder">
                  <i className="project-icon icon-color-white icon-club-members"></i>
                </div>
              )}
              <div className="portal-customization-logo-actions">
                <Button
                  color="outline-primary"
                  size="sm"
                  onClick={openFileInput}
                  disabled={isUploading}
                >
                  {isUploading ? gettext('Uploading...') : logoUrl ? gettext('Change logo') : gettext('Upload logo')}
                </Button>
                {logoUrl && (
                  <Button
                    color="outline-secondary"
                    size="sm"
                    onClick={onRemoveLogo}
                    disabled={isUploading}
                  >
                    {gettext('Remove')}
                  </Button>
                )}
              </div>
              <input
                className="d-none"
                type="file"
                accept="image/*"
                onChange={onFileChange}
                ref={fileInputRef}
              />
            </div>
          </div>
          <div className="portal-customization-section">
            <label className="portal-customization-label">{gettext('Portal name')}</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={onNameChange}
              placeholder={gettext('Support portal')}
              maxLength={50}
            />
            <p className="portal-customization-help-text">
              {gettext('Leave empty to use the default name "Support portal"')}
            </p>
          </div>
          <div className="portal-customization-actions">
            <Button color="primary" onClick={onSave} disabled={isSaving || isUploading}>
              {isSaving ? gettext('Saving...') : gettext('Save')}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default PortalCustomizationDialog;
