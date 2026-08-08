import React, { useState, useMemo } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { EmptyTip, IconButton } from '@/components';
import { getInfoByEmailFrom } from '../../../../utils';
import Item from './item';

import './index.css';

const EmailDetails = ({ details, className, ...props }) => {
  const [isShowAll, setIsShowAll] = useState(details.length <= 5);
  const [isLastExpand, setIsLastExpanded] = useState(false);

  const isUnread = useMemo(() => {
    if (details.length <= 1) return false;
    return details.slice(0, -1).some(item => Boolean(item?.unread));
  }, [details]);

  const isLastInboundAnswered = useMemo(() => {
    const lastInbound = details.slice().reverse().find(item => !item?.is_sender);
    return Boolean(lastInbound?.answered);
  }, [details]);

  if (details.length === 0) {
    return (
      <div className={classnames('seaqa-connection-email-record empty', className)}>
        <EmptyTip />
      </div>
    );
  }

  const { email } = getInfoByEmailFrom(details[0]?.email_from);

  return (
    <div className={classnames('seaqa-connection-email-record', className, { 'last-record-expand': isLastExpand })}>
      {!isShowAll && (
        <div className="seaqa-connection-email-record-details collapsed more" onClick={() => setIsShowAll(true)}>
          <div className="email-avatar">
            <IconButton icon="more" className="no-hover-bg more-tip" />
          </div>
          <div className="email-record-info">
            <div className="email-record-info-container">
              <span className="email-record-info-sender">{email}</span>
              <span className="email-record-info-content text-truncate"></span>
              {isUnread && <div className="read-status unread"/>}
              {isLastInboundAnswered && !isUnread && (
                <svg className="replied-status-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              )}
              <span className="email-record-info-time">
                {gettext('Show')}
                <span className="email-record-info-more-count">{` ${details.length - 1} ${gettext('more')} `}</span>
                {gettext('messages')}
              </span>
            </div>
            <div className="email-record-info-to">
              {'more'}
            </div>
          </div>
        </div>
      )}
      {details.map((detail, index) => {
        if (!isShowAll && index < (details.length - 1)) return null;
        return (
          <Item
            key={detail._pk}
            isLast={index === (details.length - 1)}
            detail={detail}
            isExpand={index === details.length - 1}
            setIsLastExpanded={setIsLastExpanded}
            { ...props }
          />
        );
      })}
    </div>
  );
};

export default EmailDetails;
