import React, { useState, useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { IconTooltip, toaster } from '../../components';
import { portalAPI } from '../api';
import { getPortalPublicUrl } from '../path-utils';

import './index.css';

const LeftBar = () => {
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
        icon: 'eye',
        tip: gettext('Go to portal'),
        callback: onOpenPortal,
        disabled: isOpeningPortal,
      },
    ];
  }, [isOpeningPortal, onOpenPortal]);

  return (
    <>
      <div className="seaqa-portal-left-bar d-flex align-items-center">
        {bars.map(bar => {
          return (
            <IconTooltip
              key={bar.icon}
              className="seaqa-portal-left-bar-item d-flex justify-content-center align-items-center"
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
    </>
  );
};

export default LeftBar;
