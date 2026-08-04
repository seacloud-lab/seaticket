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

const ConnectionResourceDetails = ({ resource, projectUuid, permission, connection, isSmallScreen, updateResource, onThreadUnreadChange, setIsContentEmpty }) => {
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

    // Mark the replied-to email as answered for immediate visual feedback
    const replyToPk = payload.reply_to_pk;
    if (replyToPk && details) {
      setDetails(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(item =>
          item._pk === replyToPk ? { ...item, answered: true } : item
        );
      });
    }
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

  const isEmailThreadUnread = useCallback((details) => {
    return Array.isArray(details) && details.some(item => Boolean(item?.unread));
  }, []);

  const updateEmailDetailUnread = useCallback((details, emailRecordId, unread) => {
    if (!Array.isArray(details)) return details;

    let isChanged = false;
    const nextDetails = details.map((item) => {
      if (item?._pk !== emailRecordId || Boolean(item.unread) === unread) return item;
      isChanged = true;
      return { ...item, unread };
    });

    return isChanged ? nextDetails : details;
  }, []);

  const getAutoReadEmailState = useCallback((record, details, permission) => {
    if (permission !== PERMISSION_TYPES.READ_WRITE || !Array.isArray(details) || details.length === 0) {
      return { record, details, shouldMarkThreadRead: false };
    }

    const shouldMarkThreadRead = Boolean(record?.unread) || isEmailThreadUnread(details);
    if (!shouldMarkThreadRead) return { record, details, shouldMarkThreadRead: false };

    const nextDetails = details.map((item) => {
      if (!item?.unread) return item;
      return { ...item, unread: false };
    });

    return {
      details: nextDetails,
      record: { ...record, unread: false },
      shouldMarkThreadRead,
    };
  }, [isEmailThreadUnread]);

  const handleEmailUnreadChange = useCallback((emailRecordId, unread) => {
    if (type !== CONNECTION_TYPE.EMAIL) return;

    const nextDetails = updateEmailDetailUnread(details, emailRecordId, unread);
    if (nextDetails === details) return;

    setDetails(nextDetails);
    onThreadUnreadChange?.(isEmailThreadUnread(nextDetails));
  }, [type, details, onThreadUnreadChange, isEmailThreadUnread, updateEmailDetailUnread]);

  useEffect(() => {
    setStatus('loading');
    const { connection_id, _id } = resource;
    connectionsAPI.getConnectionRecord(projectUuid, connection_id, _id).then((res) => {
      const { record, columns, linked_ticket_title, related_users } = res.data;
      const initialDetails = initConnectionResourceDetails(type, record);
      // Resolve Jira account IDs → display names in details
      if (type === CONNECTION_TYPE.JIRA_ISSUE && Array.isArray(related_users) && related_users.length > 0) {
        const jiraUserMap = {};
        related_users.forEach(u => { if (u.user_id) jiraUserMap[u.user_id] = u.name; });
        if (Array.isArray(initialDetails)) {
          initialDetails.forEach(detail => {
            if (detail.author && jiraUserMap[detail.author]) {
              detail.author = jiraUserMap[detail.author];
            }
          });
        }
        if (record.author && jiraUserMap[record.author]) {
          record.author = jiraUserMap[record.author];
        }
        if (Array.isArray(record.assignees)) {
          record.assignees = record.assignees.map(id => jiraUserMap[id] || id);
        }
      }
      const autoReadState = type === CONNECTION_TYPE.EMAIL
        ? getAutoReadEmailState(record, initialDetails, permission)
        : { record, details: initialDetails, shouldMarkThreadRead: false };
      const nextDetails = autoReadState.details;
      const nextRecord = autoReadState.record;
      const shouldMarkThreadRead = autoReadState.shouldMarkThreadRead;

      setDetails(nextDetails);
      updateResourceRef.current({ record: nextRecord, columns, linked_ticket_title, related_users });
      if (shouldMarkThreadRead) onThreadUnreadChangeRef.current?.(nextRecord.unread);
      setStatus('loaded');

      if (!shouldMarkThreadRead) return;
      connectionsAPI.modifyConnectionRecord(projectUuid, connection_id, _id, {
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
  }, [projectUuid, resource, type, updateResource, permission, getAutoReadEmailState]);

  useEffect(() => {
    if (status !== 'loaded') return;

    let contentEmpty = false;
    if (type === CONNECTION_TYPE.EMAIL) {
      contentEmpty = mergedDetails.length === 0;
    } else if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      const discourseDetails = Array.isArray(details) ? details : [];
      contentEmpty = discourseDetails.length + localDiscourseDetails.length === 0;
    } else if (type !== CONNECTION_TYPE.GITHUB_ISSUE && type !== CONNECTION_TYPE.LINEAR) {
      contentEmpty = Array.isArray(details) ? details.length === 0 : !details;
    }
    setIsContentEmpty?.(contentEmpty);
  }, [status, type, details, mergedDetails, localDiscourseDetails, setIsContentEmpty]);

  if (status === 'loading') return (<CenteredLoading />);
  if (status === 'error') return (<CenteredError>{errorMessage}</CenteredError>);

  if (type === CONNECTION_TYPE.EMAIL) {
    if (mergedDetails.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    } else {
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
    } else {
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
  }

  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    } else {
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
  }

  if (details) {
    return (<CustomizeMarkdownViewer className={`seaqa-connection-${type}-resource-details`} value={details} showTOC={false} />);
  } else {
    return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
  }
};

export default ConnectionResourceDetails;
