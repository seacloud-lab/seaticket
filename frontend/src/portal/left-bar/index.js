import React, { useState, useCallback } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import { Icon } from '../../components';
import { gettext } from '@/constants';
import Settings from '../main-panel/settings';

import './index.css';

const LeftBar = () => {
  const [isShowSettings, setIsShowSettings] = useState(false);

  const openSettings = useCallback(() => {
    setIsShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsShowSettings(false);
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
          <Icon symbol="settings-thin" />
        </div>
        <div
          className="sea-qa-portal-left-bar-item"
          onClick={goToApp}
          title={gettext('Go to app')}
        >
          <Icon symbol="app-preview" />
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
    </>
  );
};

export default LeftBar;
