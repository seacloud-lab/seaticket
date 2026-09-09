import React, { useCallback, useEffect, useRef } from 'react';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { CustomizeMarkdownViewer } from '@/components';
import { mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { CONNECTION_TYPE } from '../../../../constants';

import './index.css';

const CommonDetailItem = ({ type, detail }) => {
  const ref = useRef(null);

  const renderContentByType = useCallback((content) => {
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return (
        <div className="seaqa-resource-detail-item-content" dangerouslySetInnerHTML={{ __html: content }} />
      );
    }
    return (<CustomizeMarkdownViewer value={content} showTOC={false} />);
  }, [type]);

  useEffect(() => {
    if (!detail.highlight) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className={classnames('seaqa-resource-detail-item', { 'seaqa-connection-resource-highlight': detail.highlight })}
        ref={ref}
      >
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
      <div className="seaqa-resource-detail-item-divider"></div>
    </>
  );
};

export default CommonDetailItem;
