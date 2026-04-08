import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { EmptyTip, CustomizeMarkdownViewer, CenteredLoading, CenteredError } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { CONNECTION_TYPE } from '../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import { initConnectionResourceDetails } from '../../utils';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '@/project/api';

import './index.css';

const ConnectionResourceDetails = ({ resource, projectUuid, permission, connection, updateDetails }) => {
  const [status, setStatus] = useState('loading'); // loading / error / loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState(null);
  const [localEmailDetails, setLocalEmailDetails] = useState([]);

  const type = useMemo(() => resource.type, [resource]);

  const mergedDetails = useMemo(() => {
    if (!Array.isArray(details)) return details;
    if (type !== CONNECTION_TYPE.EMAIL) return details;
    if (!Array.isArray(localEmailDetails) || localEmailDetails.length === 0) return details;
    const knownMessageIds = new Set(details.map(item => item?.message_id).filter(Boolean));
    const extraItems = localEmailDetails.filter(item => !item?.message_id || !knownMessageIds.has(item.message_id));
    const merged = [...details, ...extraItems];
    return merged.slice().sort((a, b) => {
      const aTime = Date.parse(a?.modified_time || '') || 0;
      const bTime = Date.parse(b?.modified_time || '') || 0;
      if (aTime === bTime) return 0;
      return aTime - bTime;
    });
  }, [details, type, localEmailDetails]);

  useEffect(() => {
    setStatus('loading');
    connectionsAPI.getConnectionRowDetail(projectUuid, resource.connection_id, { _pk: resource._id }).then((res) => {
      const details = initConnectionResourceDetails(resource.type, res.data);
      setDetails(details?.details);
      updateDetails(details);
      setStatus('loaded');
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setStatus('error');
    });
  }, [projectUuid, resource]);

  const handleReplyEmailSuccess = useCallback((payload) => {
    if (!payload) return;
    const senderEmail = payload.sender_email;
    const senderName = payload.sender_name || '';
    const emailFrom = senderName && senderEmail
      ? `${senderName} <${senderEmail}>`
      : (senderEmail || senderName || '');
    const emailTo = payload.email_to || payload.replyTargetEmail?.email_from || '';
    const now = new Date().toISOString();
    const nextDetail = {
      email_from: emailFrom,
      email_to: emailTo,
      title: payload.subject || details?.title || '',
      cc: payload.cc || '',
      content: payload.content || '',
      html_content: payload.html_content || '',
      modified_time: now,
      is_sender: true,
      _pk: payload._pk,
    };
    setLocalEmailDetails(prev => [...prev, nextDetail]);
  }, [connection, details]);

  if (status === 'loading') return (<CenteredLoading />);
  if (status === 'error') return (<CenteredError>{errorMessage}</CenteredError>);

  if (type === CONNECTION_TYPE.EMAIL) {
    if (mergedDetails.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    return (
      <EmailDetails
        className={`sea-ticket-connection-resource-details sea-ticket-connection-${type}-resource-details pt-4 pb-4`}
        details={mergedDetails}
        projectUuid={projectUuid}
        connection_id={resource.connection_id}
        recordId={resource._id}
        permission={permission}
        handleReplyEmailSuccess={handleReplyEmailSuccess}
      />
    );
  }

  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    return (
      <div className={`sea-ticket-connection-resource-details sea-ticket-connection-${type}-resource-details`}>
        {details.map((detail, index) => {
          return (
            <CommonDetailItem detail={detail} type={type} key={index} />
          );
        })}
      </div>
    );
  }

  if (details) {
    return (<CustomizeMarkdownViewer className={`sea-ticket-connection-${type}-resource-details`} value={details} showTOC={false} />);
  }
  return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
};

export default ConnectionResourceDetails;
