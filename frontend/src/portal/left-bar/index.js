import React, { useState, useCallback } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import { Icon } from '../../components';
import { gettext } from '@/constants';
import Settings from '../main-panel/settings';
import UserManagement from '../main-panel/user-management';

import './index.css';

const LeftBar = () => {
  const [isShowSettings, setIsShowSettings] = useState(false);
  const [isShowInvite, setIsShowInvite] = useState(false);

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

  const goToApp = useCallback(() => {
    const { projectUuid } = window.app.pageOptions;
    window.open(`/portal/${projectUuid}/`, '_blank');
  }, []);

  return (
    <>
      <div className="sea-qa-portal-left-bar">
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
      {isShowSettings && (
        <Modal isOpen={true} toggle={closeSettings} className="portal-settings-dialog">
          <ModalHeader toggle={closeSettings}>{gettext('Settings')}</ModalHeader>
          <ModalBody>
            <Settings />
          </ModalBody>
        </Modal>
      )}
      {isShowInvite && (
        <Modal isOpen={true} toggle={closeInvite} className="portal-settings-dialog">
          <ModalHeader toggle={closeInvite}>{gettext('User and role management')}</ModalHeader>
          <ModalBody>
            <UserManagement projectUuid={window.app.pageOptions.projectUuid} />
          </ModalBody>
        </Modal>
      )}
    </>
  );
};

export default LeftBar;
