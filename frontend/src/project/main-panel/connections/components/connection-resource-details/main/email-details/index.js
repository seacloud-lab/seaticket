import React, { useMemo, useState } from 'react';
import classnames from 'classnames';
import { EmptyTip, IconButton } from '@/components';
import { gettext } from '@/constants';
import { normalizeEmailAddress, parseEmailUserInfo } from '@/utils/email';
import Item from './item';

import './index.css';

const EmailDetails = ({ details, className, ...props }) => {
  const [isShowAll, setIsShowAll] = useState(details.length <= 5 || Boolean(details.find(item => item.highlight)));
  const [isLastExpand, setIsLastExpanded] = useState(false);

  const isUnread = useMemo(() => {
    if (details.length <= 1) return false;
    return details.slice(0, -1).some(item => Boolean(item?.unread));
  }, [details]);

  const moreUsers = useMemo(() => {
    // Details are chronological; keep first-seen order and the latest info per sender.
    const usersByEmail = new Map();
    for (let index = 0; index < details.length - 1; index++) {
      const userInfo = parseEmailUserInfo(details[index]?.email_from);
      if (userInfo?.email) usersByEmail.set(normalizeEmailAddress(userInfo.email), userInfo);
    }
    return Array.from(usersByEmail.values());
  }, [details]);

  if (details.length === 0) {
    return (
      <div className={classnames('seaqa-connection-email-record empty', className)}>
        <EmptyTip />
      </div>
    );
  }

  const highlightDetail = details.find(item => item.highlight);

  return (
    <div className={classnames('seaqa-connection-email-record', className, { 'last-record-expand': isLastExpand })}>
      {!isShowAll && (
        <div className="seaqa-connection-email-record-details collapsed more" onClick={() => setIsShowAll(true)}>
          <div className="email-header">
            <div className="email-header-content">
              <div className="email-avatar">
                <IconButton icon="more" className="no-hover-bg more-tip" size={{ icon: 24 }} />
              </div>
              <div className="email-record-info">
                <div className="email-record-info-container">
                  <span className="email-record-info-sender text-truncate">
                    {moreUsers.map((user, index) => {
                      const { name, email, fullName, color, isCustomizedName } = user;
                      return (
                        <>
                          {index !== 0 && (<span>{', '}</span>)}
                          <span key={index} title={fullName} style={{ color }}>
                            {isCustomizedName && name ? name : email}
                          </span>
                        </>
                      );
                    }).filter(Boolean)}
                  </span>
                  <span className="email-record-info-content text-truncate"></span>
                  {isUnread && <div className="read-status unread"/>}
                  <span className="email-record-info-time">
                    {gettext('Show')}
                    <span className="email-record-info-more-count">{` ${details.length - 1} ${gettext('more')} `}</span>
                    {gettext('messages')}
                  </span>
                </div>
                <div className="email-record-info-participants">
                  {'more'}
                </div>
              </div>
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
            isExpand={highlightDetail ? detail.highlight : index === details.length - 1}
            setIsLastExpanded={setIsLastExpanded}
            { ...props }
          />
        );
      })}
    </div>
  );
};

export default EmailDetails;
