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
  const [previewLogoUrl, setPreviewLogoUrl] = useState('');
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setName(portalName || '');
    setLogoUrl(portalLogo || '');
    setPendingLogoFile(null);
    setPreviewLogoUrl('');
  }, [portalName, portalLogo]);

  useEffect(() => {
    return () => {
      if (previewLogoUrl) {
        URL.revokeObjectURL(previewLogoUrl);
      }
    };
  }, [previewLogoUrl]);

  const openFileInput = useCallback(() => {
    fileInputRef.current && fileInputRef.current.click();
  }, []);

  const MAX_FILE_SIZE = 1024 * 1024;

  const onFileChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toaster.danger(gettext('Please upload an image file'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toaster.danger(gettext('The file is too large. Allowed maximum size is 1MB.'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setPendingLogoFile(file);
    setPreviewLogoUrl(URL.createObjectURL(file));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const onNameChange = useCallback((e) => {
    setName(e.target.value);
  }, []);

  const onSave = useCallback(async () => {
    if (isSaving || isUploading) return;
    setIsSaving(true);

    try {
      let nextLogoUrl = logoUrl;
      if (pendingLogoFile) {
        setIsUploading(true);
        try {
          const res = await portalAPI.uploadPortalLogo(projectUuid, pendingLogoFile);
          nextLogoUrl = res.data?.file_url || res.data?.url || '';
          if (!nextLogoUrl) {
            toaster.danger(gettext('Upload failed'));
            return;
          }
        } catch (error) {
          const serverMessage = error.response?.data?.error_msg;
          toaster.danger(serverMessage || gettext('Upload failed'));
          return;
        } finally {
          setIsUploading(false);
        }
      }

      await portalAPI.updateSettings(projectUuid, {
        portal_name: name,
        portal_logo: nextLogoUrl,
      });

      setLogoUrl(nextLogoUrl);
      setPendingLogoFile(null);
      setPreviewLogoUrl('');
      window.app.pageOptions.portalName = name;
      window.app.pageOptions.portalLogo = nextLogoUrl;
      onUpdate(name, nextLogoUrl);
      toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
      toggle();
    } catch (error) {
      toaster.danger(gettext('Save failed'));
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [name, logoUrl, pendingLogoFile, isSaving, isUploading, toggle, onUpdate]);

  const onRemoveLogo = useCallback(() => {
    setPendingLogoFile(null);
    setPreviewLogoUrl('');
    setLogoUrl('');
  }, []);

  const displayedLogoUrl = previewLogoUrl || logoUrl;

  return (
    <Modal isOpen={true} toggle={toggle} className="portal-customization-dialog">
      <CustomModalHeader toggle={toggle}>{gettext('Portal customization')}</CustomModalHeader>
      <ModalBody>
        <div className="portal-customization-content">
          <div className="portal-customization-section">
            <label className="portal-customization-label">{gettext('Logo')}</label>
            <div className="portal-customization-logo-area">
              {displayedLogoUrl ? (
                <div className="portal-customization-logo-preview">
                  <img src={displayedLogoUrl} alt="" />
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
                  disabled={isSaving || isUploading}
                >
                  {isUploading ? gettext('Uploading...') : displayedLogoUrl ? gettext('Change logo') : gettext('Upload logo')}
                </Button>
                {displayedLogoUrl && (
                  <Button
                    color="outline-secondary"
                    size="sm"
                    onClick={onRemoveLogo}
                    disabled={isSaving || isUploading}
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
