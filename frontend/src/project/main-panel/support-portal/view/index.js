import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext, mediaUrl, server, siteRoot } from '@/constants';
import { CustomizeBtn } from '@/components';

import './index.css';

const { projectUuid, isProjectAdmin } = window.app.pageOptions;

const View = () => {
  const [height, setHeight] = useState(600);

  const viewRef = useRef(null);

  const editURL = useMemo(() => `${server}${siteRoot}portal-edit/${projectUuid}/`, [projectUuid]);
  const viewURL = useMemo(() => `${server}${siteRoot}portal/${projectUuid}/`, [projectUuid]);

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

  return (
    <div className={classnames('sea-ticket-support-portal-view', { 'pt-6 pb-4': height <= 424 })} ref={viewRef}>
      <div className="sea-ticket-support-portal-tip-img">
        <img src={`${mediaUrl}img/support-portal.png`} alt="" />
      </div>
      <div className="sea-ticket-support-portal-tip-title">
        {gettext('What is support portal?')}
      </div>
      <div className="sea-ticket-support-portal-tip-text">
        {gettext('Support portal allows external users to self-service and obtain support information, including documentation, knowledge base articles, and ticket management. It acts as the customer-facing interface for your support services.')}
      </div>
      <div className="sea-ticket-support-portal-tip-pages">
        {isProjectAdmin && (
          <CustomizeBtn color="primary" icon="rename" onClick={() => window.open(editURL, '_blank', 'noopener,noreferrer')}>
            {gettext('Edit portal')}
          </CustomizeBtn>
        )}
        <CustomizeBtn color="secondary" icon="open-in-new-tab" onClick={() => window.open(viewURL, '_blank', 'noopener,noreferrer')}>
          {gettext('View portal')}
        </CustomizeBtn>
      </div>
    </div>
  );
};

export default View;
