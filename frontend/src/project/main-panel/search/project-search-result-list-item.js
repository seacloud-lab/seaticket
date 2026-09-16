import React, { useCallback, useRef } from 'react';
import { getPreviewContent } from '@seafile/seafile-editor';
import dayjs from 'dayjs';
import { CONNECTION_TYPES, CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { getResourceIconURL } from '@/project/utils';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

import './project-search-result-list-item.css';

const ProjectSearchResultListItem = ({
  type, id, title, subtitle, content = '', bumped_at = '', searchValue, expandItem
}) => {
  const connectionOption = CONNECTION_TYPES.find(c => c.type === type);
  const detailContentRef = useRef(null);

  if (detailContentRef.current === null) {
    // DISCOURSE_FORUM content format is HTML, other types formats are Markdown
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      detailContentRef.current = content;
    } else {
      try {
        const isMarkdown = true;
        const previewTextNeedSlice = false;
        const result = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
        if (!result || !result.previewText) {
          detailContentRef.current = content;
        } else {
          const { previewText } = result;
          if (!searchValue) {
            detailContentRef.current = previewText;
          } else {
            detailContentRef.current = previewText.replace(new RegExp(searchValue, 'ig'), (match) => `<span class="font-weight-bold">${match}</span>`);
          }
        }
      } catch (error) {
        detailContentRef.current = content || '';
      }
    }
  }

  const handleItemClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    expandItem();
  }, [expandItem]);

  const iconSrc = getResourceIconURL(type);
  let altText = '';

  if (type === 'knowledge_base') {
    altText = 'Knowledge Base';
  } else if (type === 'ticket') {
    altText = 'Ticket';
  } else {
    altText = connectionOption ? connectionOption.name : (type || '');
  }

  return (
    <div className="seaqa-project-search-result-list-item" key={id} onClick={handleItemClick}>
      <div className="seaqa-project-search-result-list-item-icon">
        <img src={iconSrc} alt={altText} className="seaqa-project-connection-type-icon" />
      </div>
      <div className="seaqa-project-search-result-list-item-content">
        <div className="seaqa-project-search-result-list-item-title">
          <span className="text-truncate seaqa-project-search-result-list-item-title-content" title={title || ''}>{title || ''}</span>
        </div>
        <div className="seaqa-project-search-result-list-item-path">{subtitle || ''}</div>
        {bumped_at &&
          <div className="seaqa-project-search-result-list-item-time" title={formatWithTimezone(bumped_at)}>
            {dayjs(bumped_at).format('YYYY-MM-DD HH:mm:ss')}
          </div>
        }
        {content &&
          <div className="seaqa-project-search-result-list-item-detail" dangerouslySetInnerHTML={{ __html: detailContentRef.current }}></div>
        }
      </div>
    </div>
  );
};

export default ProjectSearchResultListItem;
