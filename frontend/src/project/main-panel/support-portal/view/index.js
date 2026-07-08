import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext, mediaUrl, server, siteRoot } from '@/constants';
import { CustomizeBtn, toaster } from '@/components';
import { portalAPI } from '@/portal/api';
import { Utils } from '@/utils/utils';

import './index.css';

const { projectUuid, isProjectAdmin } = window.app.pageOptions;

const View = () => {
  const [height, setHeight] = useState(600);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const viewRef = useRef(null);

  const editURL = useMemo(() => `${server}${siteRoot}portal-edit/${projectUuid}/`, [projectUuid]);
  useEffect(() => {
    const dom = viewRef.current;
    const handleResize = () => {
      if (!dom) return;
      setHeight(dom.offsetHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);

    return () => {
      dom && resizeObserver.unobserve(dom);
    };
  }, []);

  const onViewPortal = useCallback(() => {
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
  }, [isOpeningPortal, projectUuid]);

  return (
    <div className={classnames('seaqa-support-portal-view', { 'pt-6 pb-4': height <= 424 })} ref={viewRef}>
      <div className="seaqa-support-portal-tip-img">
        <img src={`${mediaUrl}img/support-portal.png`} alt="" />
      </div>
      <div className="seaqa-support-portal-tip-title">
        {gettext('What is support portal?')}
      </div>
      <div className="seaqa-support-portal-tip-text">
        {gettext('Support portal allows external users to self-service and obtain support information, including documentation, knowledge base articles, and ticket management. It acts as the customer-facing interface for your support services.')}
      </div>
      <div className="seaqa-support-portal-tip-pages">
        {isProjectAdmin && (
          <CustomizeBtn color="primary" icon="rename" onClick={() => window.open(editURL, '_blank', 'noopener,noreferrer')}>
            {gettext('Edit portal')}
          </CustomizeBtn>
        )}
        <CustomizeBtn color="secondary" icon="open-in-new-tab" onClick={onViewPortal} disabled={isOpeningPortal}>
          {gettext('View portal')}
        </CustomizeBtn>
      </div>
    </div>
  );
};

export default View;
