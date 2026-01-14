import React, { useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { EmptyTip, IconButton } from '@/components';
import { getInfoByEmailFrom } from '../../../utils';
import Item from './item';

import './index.css';

const EmailDetails = ({ details, className, assetURLPrefix }) => {
  const [isShowAll, setIsShowAll] = useState(details.length <= 5);
  const { email } = getInfoByEmailFrom(details[0]['email_from']);

  if (details.length === 0) {
    return (
      <div className={classnames('sea-ticket-connection-email-record empty', className)}>
        <EmptyTip />
      </div>
    );
  }

  return (
    <div className={classnames('sea-ticket-connection-email-record', className)}>
      {!isShowAll && (
        <div className="sea-ticket-connection-email-record-details collapsed more" onClick={() => setIsShowAll(true)}>
          <div className="email-avatar">
            <IconButton icon="more" className="no-hover-bg more-tip" />
          </div>
          <div className="email-record-info">
            <div className="email-record-info-container">
              <span className="email-record-info-sender">{email}</span>
              <span className="email-record-info-content text-truncate"></span>
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
        return (<Item key={index} detail={detail} isExpand={index === details.length - 1} assetURLPrefix={assetURLPrefix} />);
      })}
    </div>
  );
};

export default EmailDetails;
