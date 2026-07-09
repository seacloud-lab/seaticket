import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { EmptyTip, CustomizeMarkdownViewer, CenteredLoading, CenteredError } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import DiscourseDetails from './discourse-details';
import GitHubIssuesDetails from './github-issues-details';
import { initConnectionResourceDetails } from '../../../utils';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '@/project/api';

import './index.css';

const ConnectionResourceDetails = ({ resource, projectUuid, permission, connection, isSmallScreen, updateResource }) => {
  const [status, setStatus] = useState('loading'); // loading / error / loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState(null);
  const [localEmailDetails, setLocalEmailDetails] = useState([]);
  const [localDiscourseDetails, setLocalDiscourseDetails] = useState([]);
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
      title: payload.subject || details[0]?.title || '',
      cc: payload.cc || '',
      content: payload.content || '',
      html_content: payload.html_content || '',
      modified_time: now,
      is_sender: true,
      _pk: payload._pk,
    };
    setLocalEmailDetails(prev => [...prev, nextDetail]);
  }, [details]);

  const handleReplyDiscourseSuccess = useCallback((payload) => {
    if (!payload) return;
    const now = new Date().toISOString();
    const nextDetail = {
      author: payload.author,
      content: payload.content,
      post_number: payload.post_number,
      modified_time: now,
      time: now,
      body: payload.content,
      _pk: payload._pk,
    };
    setLocalDiscourseDetails(prev => [...prev, nextDetail]);
  }, []);

  useEffect(() => {
    setStatus('loading');
    connectionsAPI.getConnectionRecord(projectUuid, resource.connection_id, resource._id).then((res) => {
      const { record, columns, linked_ticket_title, related_users } = res.data;
      const details = initConnectionResourceDetails(resource.type, record);
      setDetails(details);
      updateResource({ record, columns, linked_ticket_title, related_users });
      setStatus('loaded');
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setStatus('error');
    });
  }, [projectUuid, resource, type, updateResource]);

  if (status === 'loading') return (<CenteredLoading />);
  if (status === 'error') return (<CenteredError>{errorMessage}</CenteredError>);

  if (type === CONNECTION_TYPE.EMAIL) {
    if (mergedDetails.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    return (
      <EmailDetails
        className={`seaqa-connection-resource-details seaqa-connection-${type}-resource-details pt-4 pb-4`}
        details={mergedDetails}
        projectUuid={projectUuid}
        connection_id={resource.connection_id}
        recordId={resource._id}
        permission={permission}
        handleReplyEmailSuccess={handleReplyEmailSuccess}
      />
    );
  }

  if (type === CONNECTION_TYPE.GITHUB_ISSUE || type === CONNECTION_TYPE.LINEAR) {
    return (
      <GitHubIssuesDetails
        className={`seaqa-connection-resource-details seaqa-connection-${type}-resource-details pt-4 pb-4`}
        details={details}
        isSmallScreen={isSmallScreen}
      />
    );
  }

  if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
    const discourseDetails = Array.isArray(details) ? details : [];
    const mergedDiscourseDetails = [...discourseDetails, ...localDiscourseDetails];
    if (mergedDiscourseDetails.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    return (
      <DiscourseDetails
        className={`seaqa-connection-resource-details seaqa-connection-${type}-resource-details pt-4 pb-4`}
        details={mergedDiscourseDetails}
        projectUuid={projectUuid}
        connection_id={resource.connection_id}
        recordId={resource._id}
        permission={permission}
        handleReplyDiscourseSuccess={handleReplyDiscourseSuccess}
      />
    );
  }

  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    return (
      <div className={`seaqa-connection-resource-details seaqa-connection-${type}-resource-details`}>
        {details.map((detail, index) => {
          return (
            <CommonDetailItem detail={detail} type={type} key={index} />
          );
        })}
      </div>
    );
  }

  if (details) {
    return (<CustomizeMarkdownViewer className={`seaqa-connection-${type}-resource-details`} value={details} showTOC={false} />);
  }
  return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
};

export default ConnectionResourceDetails;
