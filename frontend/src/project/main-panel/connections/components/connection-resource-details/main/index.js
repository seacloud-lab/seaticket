import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { EmptyTip, CustomizeMarkdownViewer, CenteredLoading, CenteredError, toaster } from '@/components';
import { gettext, mediaUrl, PERMISSION_TYPES } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import DiscourseDetails from './discourse-details';
import GitHubIssuesDetails from './github-issues-details';
import { initConnectionResourceDetails } from '../../../utils';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '@/project/api';

import './index.css';

const isEmailThreadUnread = (details) => {
  return Array.isArray(details) && details.some(item => Boolean(item?.unread));
};

const updateEmailDetailUnread = (details, emailRecordId, unread) => {
  if (!Array.isArray(details)) return details;

  let isChanged = false;
  const nextDetails = details.map((item) => {
    if (item?._pk !== emailRecordId || Boolean(item.unread) === unread) return item;
    isChanged = true;
    return { ...item, unread };
  });

  return isChanged ? nextDetails : details;
};

const getAutoReadEmailState = (record, details, permission) => {
  if (permission !== PERMISSION_TYPES.READ_WRITE || !Array.isArray(details) || details.length === 0) {
    return { record, details, target: null };
  }

  const lastDetailIndex = details.length - 1;
  const lastDetail = details[lastDetailIndex];
  if (!lastDetail?.unread) return { record, details, target: null };

  const nextDetails = details.map((item, index) => {
    if (index !== lastDetailIndex) return item;
    return { ...item, unread: false };
  });

  return {
    details: nextDetails,
    record: { ...record, unread: isEmailThreadUnread(nextDetails) },
    target: lastDetail._pk,
  };
};

const ConnectionResourceDetails = ({ resource, projectUuid, permission, connection, isSmallScreen, updateResource, onThreadUnreadChange }) => {
  const [status, setStatus] = useState('loading'); // loading / error / loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState(null);
  const [localEmailDetails, setLocalEmailDetails] = useState([]);
  const [localDiscourseDetails, setLocalDiscourseDetails] = useState([]);
  const updateResourceRef = useRef(updateResource);
  const onThreadUnreadChangeRef = useRef(onThreadUnreadChange);
  const type = useMemo(() => resource.type, [resource]);

  useEffect(() => {
    updateResourceRef.current = updateResource;
    onThreadUnreadChangeRef.current = onThreadUnreadChange;
  }, [updateResource, onThreadUnreadChange]);

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

  const handleEmailUnreadChange = useCallback((emailRecordId, unread) => {
    if (type !== CONNECTION_TYPE.EMAIL) return;

    const nextDetails = updateEmailDetailUnread(details, emailRecordId, unread);
    if (nextDetails === details) return;

    setDetails(nextDetails);
    onThreadUnreadChange?.(isEmailThreadUnread(nextDetails));
  }, [type, details, onThreadUnreadChange]);

  useEffect(() => {
    setStatus('loading');
    const { connection_id, _id } = resource;
    connectionsAPI.getConnectionRecord(projectUuid, connection_id, _id).then((res) => {
      const { record, columns, linked_ticket_title, related_users } = res.data;
      const initialDetails = initConnectionResourceDetails(type, record);
      const autoReadState = type === CONNECTION_TYPE.EMAIL
        ? getAutoReadEmailState(record, initialDetails, permission)
        : { record, details: initialDetails, target: null };
      const nextDetails = autoReadState.details;
      const nextRecord = autoReadState.record;
      const autoReadTarget = autoReadState.target;

      setDetails(nextDetails);
      updateResourceRef.current({ record: nextRecord, columns, linked_ticket_title, related_users });
      if (autoReadTarget) onThreadUnreadChangeRef.current?.(nextRecord.unread);
      setStatus('loaded');

      if (!autoReadTarget) return;
      connectionsAPI.unreadConnectionEmail(projectUuid, connection_id, {
        record_id: autoReadTarget,
        unread: false,
      }).catch((error) => {
        setDetails(initialDetails);
        updateResourceRef.current({ record, columns, linked_ticket_title, related_users });
        onThreadUnreadChangeRef.current?.(record.unread);
        toaster.danger(Utils.getErrorMsg(error));
      });
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setStatus('error');
    });
  }, [projectUuid, resource, type, updateResource, permission]);

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
        onUnreadChange={handleEmailUnreadChange}
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
