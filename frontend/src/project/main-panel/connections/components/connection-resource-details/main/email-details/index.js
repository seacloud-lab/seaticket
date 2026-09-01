import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { EmptyTip, IconButton } from '@/components';
import { getInfoByEmailFrom } from '../../../../utils';
import Item from './item';

import './index.css';

const EmailDetails = ({ details, className, focus, ...props }) => {
  const lastIndex = details.length - 1;
  const targetIndex = useMemo(() => {
    if (!focus?.messageId) return -1;
    return details.findIndex(item => item?.message_id && String(item.message_id) === String(focus.messageId));
  }, [details, focus]);
  const hasFocus = targetIndex >= 0;
  const expandIndex = hasFocus ? targetIndex : lastIndex;

  const [isShowAll, setIsShowAll] = useState(details.length <= 5 || (hasFocus && targetIndex !== lastIndex));
  const [isLastExpand, setIsLastExpanded] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => {
    if (!hasFocus || !focusRef.current) return;
    focusRef.current.scrollIntoView({ block: 'center' });
  }, [hasFocus]);

  const isUnread = useMemo(() => {
    if (details.length <= 1) return false;
    return details.slice(0, -1).some(item => Boolean(item?.unread));
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
        if (!isShowAll && index < lastIndex) return null;
        const isFocused = index === targetIndex;
        return (
          <Item
            key={detail._pk}
            isLast={index === lastIndex}
            detail={detail}
            isExpand={index === expandIndex}
            isFocused={isFocused}
            containerRef={isFocused ? focusRef : undefined}
            setIsLastExpanded={setIsLastExpanded}
            { ...props }
          />
        );
      })}
    </div>
  );
};

export default EmailDetails;
