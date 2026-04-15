import React, { useCallback } from 'react';
import dayjs from 'dayjs';
import { CustomizeMarkdownViewer } from '@/components';
import { mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { CONNECTION_TYPE } from '../../../../constants';

import './index.css';

const CommonDetailItem = ({ type, detail }) => {

  const renderContentByType = useCallback((content) => {
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return (
        <div className="sea-ticket-resource-detail-item-content" dangerouslySetInnerHTML={{ __html: content }} />
      );
    }
    return (<CustomizeMarkdownViewer value={content} showTOC={false} />);
  }, [type]);

  return (
    <div className="sea-ticket-resource-detail-item">
      <div className="author-info-wrapper">
        <div className="author-info-left">
          <div className="author-avatar">
            <img alt='' src={`${mediaUrl}avatars/default.png`}/>
          </div>
          <div className="author-name">{detail.author}</div>
        </div>
        <div className="author-time" title={formatWithTimezone(detail.modified_time)}>
          {dayjs(detail.modified_time).format('YYYY-MM-DD HH:mm:ss')}
        </div>
      </div>
      {renderContentByType(detail.content)}
    </div>
  );
};

export default CommonDetailItem;
