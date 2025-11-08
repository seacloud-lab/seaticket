import React, { useCallback, useMemo } from 'react';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { getNumberDisplayString, formatWithTimezone } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';
import { gettext } from '@/constants';

import './index.css';

const CustomizeDefinition = ({ element, attributes, editor, onClick, sources, settings }) => {
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);

  const sourceModel = useMemo(() => {
    if (!element) return {};
    if (!Array.isArray(sources) || sources.length === 0) return {};
    const identifier = Number(element.identifier);
    const sourceIndex = identifier - 1;
    const source = sources[sourceIndex];
    const { type, connection_name, server_url, content_preview, bumped_at, mtime, updated_at, score } = source;
    return {
      identifier: identifier,
      icon: getConnectionIcon(type),
      title: connection_name,
      url: server_url,
      content: content_preview,
      mtime: bumped_at || mtime || updated_at || '2014-09-09',
      score: getNumberDisplayString(score, { format: 'number', enable_precision: true, precision: 2 }),
    };
  }, [element, sources]);

  const renderContent = useCallback((content) => {
    const isMarkdown = true;
    const previewTextNeedSlice = false;
    const { previewText } = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
    return previewText;
  }, []);

  if (!element) return null;

  const { identifier, icon, title, content, mtime, score } = sourceModel;

  return (
    <div className="sea-ai-chat-customize-definition" onClick={onClick} data-id={element.id}>
      <div className="sea-ai-chat-customize-definition-simple-info">
        <div className="sea-ai-chat-customize-definition-order">{identifier}</div>
        <div className="sea-ai-chat-customize-definition-title-score">
          <div className="sea-ai-chat-customize-definition-title text-truncate">{title}</div>
          {isShowScore && (
            <div className="sea-ai-chat-customize-definition-score">{score}</div>
          )}
        </div>
        <div className="sea-ai-chat-customize-definition-avatar">
          <img src={icon} alt={title} />
        </div>
      </div>
      {(mtime) && (
        <div className="sea-ai-chat-customize-definition-other-info">
          {mtime && (
            <div className="sea-ai-chat-customize-definition-mtime" title={formatWithTimezone(mtime)}>
              {`${gettext('Updated')} ${dayjs(mtime).fromNow()}`}
            </div>
          )}
        </div>
      )}
      {content && (
        <div className="sea-ai-chat-customize-definition-content" dangerouslySetInnerHTML={{ __html: renderContent(content) }}></div>
      )}
    </div>
  );
};

export default CustomizeDefinition;
