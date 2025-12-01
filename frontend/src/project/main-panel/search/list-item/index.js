import React, { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { getPreviewContent } from '@seafile/seafile-editor';
import { CONNECTION_TYPES } from '../../connections/constants';
import { getConnectionIcon } from '../../connections/utils';
import { formatWithTimezone, getNumberDisplayString } from '@/sea-metadata/utils/column';
import { mediaUrl } from '@/constants';

import './index.css';

const ListItem = ({ type, id, title, subtitle, url, content = '', bumped_at = '', score = '', searchValue, settings }) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);

  const openOriginalURL = useCallback(() => {
    if (!url) return;
    window.open(url);
  }, [url]);

  const renderDetail = () => {
    try {
      const isMarkdown = true;
      const previewTextNeedSlice = false;
      const result = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
      if (!result || !result.previewText) return content;
      const { previewText } = result;
      if (!searchValue) return previewText;
      return previewText.replace(new RegExp(searchValue, 'ig'), (match) => `<span class="font-weight-bold">${match}</span>`);
    } catch (error) {
      return content || '';
    }
  };

  const iconSrc = type === 'knowledge_base' ? `${mediaUrl}img/knowledge-base.png` : getConnectionIcon(type);
  const altText = connectionOption ? connectionOption.name : (type === 'knowledge_base' ? 'Knowledge Base' : (type || ''));

  return (
    <div className="list-item" key={id} onClick={openOriginalURL}>
      <div className="list-item-icon">
        <img src={iconSrc} alt={altText} className="sea-qa-project-connection-type-icon" />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">
          <span className="text-truncate list-item-title-content">{title || ''}</span>
          {isShowScore && score && (
            <span className="list-item-score ml-2">
              {getNumberDisplayString(score, { format: 'number', enable_precision: true, precision: 2 })}
            </span>
          )}
        </div>
        <div className="list-item-path">{subtitle || ''}</div>
        {bumped_at &&
          <div className="list-item-time" title={formatWithTimezone(bumped_at)}>
            {dayjs(bumped_at).format('YYYY-MM-DD HH:mm:ss')}
          </div>
        }
        {content &&
          <div className="list-item-detail" dangerouslySetInnerHTML={{ __html: renderDetail() }}></div>
        }
      </div>
    </div>
  );
};

export default ListItem;
