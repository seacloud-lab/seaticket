import React, { useState, useCallback } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import CustomModalHeader from '../../components/modal-header';
import { Icon } from '../../components';
import { gettext } from '@/constants';
import Settings from '../main-panel/settings';
import UserManagement from '../main-panel/user-management';
import PortalCustomizationDialog from './portal-customization-dialog';

import './index.css';

const LeftBar = ({ portalName, portalLogo, onPortalUpdate }) => {
  const [isShowSettings, setIsShowSettings] = useState(false);
  const [isShowInvite, setIsShowInvite] = useState(false);
  const [isShowCustomization, setIsShowCustomization] = useState(false);

  const openSettings = useCallback(() => {
    setIsShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsShowSettings(false);
  }, []);

  const openInvite = useCallback(() => {
    setIsShowInvite(true);
  }, []);
  const closeInvite = useCallback(() => {
    setIsShowInvite(false);
  }, []);

  const openCustomization = useCallback(() => {
    setIsShowCustomization(true);
  }, []);

  const closeCustomization = useCallback(() => {
    setIsShowCustomization(false);
  }, []);

  const goToApp = useCallback(() => {
    const { projectUuid } = window.app.pageOptions;
    window.open(`/portal/${projectUuid}/`, '_blank');
  }, []);

  return (
    <>
      <div className="sea-qa-portal-left-bar">
        <div
          className="sea-qa-portal-left-bar-item"
          onClick={openCustomization}
          title={gettext('Portal customization')}
        >
          <Icon symbol="edit" />
        </div>
        <div
          className="sea-qa-portal-left-bar-item"
          onClick={openSettings}
          title={gettext('Settings')}
        >
          <Icon symbol="set-up" />
        </div>
        <div
          className="sea-qa-portal-left-bar-item"
          onClick={goToApp}
          title={gettext('Go to app')}
        >
          <Icon symbol="app-preview" />
        </div>
        <div
          className="sea-qa-portal-left-bar-item"
          onClick={openInvite}
          title={gettext('User management')}
        >
          <Icon symbol="manage-members" />
        </div>
      </div>
      {isShowCustomization && (
        <PortalCustomizationDialog
          toggle={closeCustomization}
          portalName={portalName}
          portalLogo={portalLogo}
          onUpdate={onPortalUpdate}
        />
      )}
      {isShowSettings && (
        <Modal isOpen={true} toggle={closeSettings} className="portal-settings-dialog">
          <CustomModalHeader toggle={closeSettings}>{gettext('Settings')}</CustomModalHeader>
          <ModalBody>
            <Settings />
          </ModalBody>
        </Modal>
      )}
      {isShowInvite && (
        <Modal isOpen={true} toggle={closeInvite} className="portal-settings-dialog">
          <CustomModalHeader toggle={closeInvite}>{gettext('External users management')}</CustomModalHeader>
          <ModalBody>
            <UserManagement projectUuid={window.app.pageOptions.projectUuid} />
          </ModalBody>
        </Modal>
      )}
    </>
  );
};

export default LeftBar;
