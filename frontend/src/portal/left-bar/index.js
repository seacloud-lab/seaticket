import React, { useState, useCallback, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import CustomModalHeader from '../../components/modal-header';
import { IconTooltip } from '../../components';
import { gettext } from '@/constants';
import Settings from '../main-panel/settings';
import UserManagement from '../main-panel/user-management';

import './index.css';

const LeftBar = () => {
  const [isShowSettings, setIsShowSettings] = useState(false);
  const [isShowInvite, setIsShowInvite] = useState(false);

  const bars = useMemo(() => {
    return [
      {
        icon: 'set-up',
        tip: gettext('Settings'),
        callback: () => setIsShowSettings(true),
      }, {
        icon: 'eye',
        tip: gettext('Go to app'),
        callback: () => {
          const { projectUuid } = window.app.pageOptions;
          window.open(`/portal/${projectUuid}/`, '_blank');
        },
      }, {
        icon: 'manage-members',
        tip: gettext('User management'),
        callback: () => setIsShowInvite(true),
      },
    ];
  }, []);

  const closeSettings = useCallback(() => {
    setIsShowSettings(false);
  }, []);

  const closeInvite = useCallback(() => {
    setIsShowInvite(false);
  }, []);

  return (
    <>
      <div className="seaqa-portal-left-bar">
        {bars.map(bar => {
          return (
            <IconTooltip
              key={bar.icon}
              className="seaqa-portal-left-bar-item"
              size={{ btn: 50, icon: 20 }}
              hoverBackground={true}
              icon={bar.icon}
              tip={bar.tip}
              onClick={bar.callback}
            />
          );
        })}
      </div>
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
