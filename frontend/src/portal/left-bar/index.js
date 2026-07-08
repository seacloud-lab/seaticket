import React, { useState, useCallback, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import CustomModalHeader from '../../components/modal-header';
import { IconTooltip, toaster } from '../../components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import Settings from '../main-panel/settings';
import UserManagement from '../main-panel/user-management';
import { portalAPI } from '../api';
import { getPortalPublicUrl } from '../path-utils';

import './index.css';

const LeftBar = () => {
  const [isShowSettings, setIsShowSettings] = useState(false);
  const [isShowInvite, setIsShowInvite] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const onOpenPortal = useCallback(() => {
    const { projectUuid, isPortalDomain } = window.app.pageOptions;
    if (isPortalDomain) {
      window.open(getPortalPublicUrl(), '_blank', 'noopener,noreferrer');
      return;
    }

    if (isOpeningPortal) return;
    setIsOpeningPortal(true);
    portalAPI.createPreviewToken(projectUuid).then(res => {
      const previewUrl = res.data && res.data.preview_url;
      if (!previewUrl) {
        toaster.danger(gettext('Portal preview URL is unavailable.'));
        return;
      }
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsOpeningPortal(false);
    });
  }, [isOpeningPortal]);

  const bars = useMemo(() => {
    return [
      {
        icon: 'set-up',
        tip: gettext('Settings'),
        callback: () => setIsShowSettings(true),
      }, {
        icon: 'eye',
        tip: gettext('Go to app'),
        callback: onOpenPortal,
        disabled: isOpeningPortal,
      }, {
        icon: 'manage-members',
        tip: gettext('User management'),
        callback: () => setIsShowInvite(true),
      },
    ];
  }, [isOpeningPortal, onOpenPortal]);

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
              disabled={bar.disabled}
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
