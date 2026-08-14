import React, { useEffect, useMemo, useState } from 'react';
import { parseAndCleanHTML } from '@seafile/sea-email-editor/dist/utils/dom';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { initConnectionResourceDetails } from '@/project/main-panel/connections/utils';
import { getDefaultEmailReplyTo } from '@/project/main-panel/agent/utils';

const { projectUuid } = window.app.pageOptions;

const EmailPreview = ({ value, sourceId }) => {
  const { to = [], cc = [], content = '', isHtml = false } = value || {};
  const [displayTo, setDisplayTo] = useState(to);
  const safeHTML = useMemo(() => {
    if (!isHtml || !content) return '';
    return parseAndCleanHTML(content).innerHTML;
  }, [content, isHtml]);

  useEffect(() => {
    setDisplayTo(to);
    if (to.length > 0 || !sourceId) return;

    const sourceInfo = String(sourceId).split('_');
    if (sourceInfo.length !== 2) return;
    const connectionId = Number(sourceInfo[0]);
    const recordId = Number(sourceInfo[1]);
    if (!Number.isInteger(connectionId) || !Number.isInteger(recordId)) return;

    let isCanceled = false;
    connectionsAPI.getConnectionRecord(projectUuid, connectionId, recordId).then((res) => {
      if (isCanceled) return;
      const emails = initConnectionResourceDetails(CONNECTION_TYPE.EMAIL, res.data?.record || {});
      const defaultTo = getDefaultEmailReplyTo(emails);
      if (defaultTo) setDisplayTo([defaultTo]);
    }).catch(() => {});

    return () => {
      isCanceled = true;
    };
  }, [sourceId, to]);

  return (
    <div className="suggestion-content-preview-wrapper suggestion-email-content-preview-wrapper">
      <div className="suggestion-email-meta-line">
        <span className="suggestion-email-meta-label">{gettext('To')}:</span>
        <span className="text-truncate" title={displayTo.join(', ')}>{displayTo.join(', ') || '-'}</span>
      </div>
      <div className="suggestion-email-meta-line">
        <span className="suggestion-email-meta-label">{gettext('Cc')}:</span>
        <span className="text-truncate" title={cc.join(', ')}>{cc.join(', ') || '-'}</span>
      </div>
      <div className="suggestion-content-preview display-mask">
        {isHtml ? (
          <div className="suggestion-email-html-preview" dangerouslySetInnerHTML={{ __html: safeHTML }} />
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export default EmailPreview;
