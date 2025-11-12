import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { getPreviewContent } from '@seafile/seafile-editor';
import { getNumberDisplayString, formatWithTimezone } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';
import { gettext } from '@/constants';

import './index.css';

const Definition = ({ element, attributes, editor, onClick, sources, settings }) => {
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);

  const source = useMemo(() => {
    if (!element) return {};
    if (!Array.isArray(sources) || sources.length === 0) return {};
    const identifier = Number(element.identifier);
    const sourceIndex = identifier - 1;
    const originSource = sources[sourceIndex];
    const { type, connection_name, server_url, content_preview, bumped_at, mtime, updated_at, score } = originSource;
    return {
      identifier: identifier,
      icon: getConnectionIcon(type),
      title: connection_name,
      url: server_url,
      content: content_preview,
      mtime: bumped_at || mtime || updated_at || '',
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

  const { identifier, icon, title, content, mtime, score } = source;

  const identifierIndex = identifier - 1;

  return (
    <div
      className={classnames('sea-ai-chat-customize-definition', { 'ml-0': identifierIndex % 3 === 0 })}
      onClick={onClick}
      data-id={element.id}
      { ...attributes }
    >
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
        <div className="sea-ai-chat-customize-definition-mtime text-truncate" title={formatWithTimezone(mtime)}>
          {`${gettext('Updated')} ${dayjs(mtime).fromNow()}`}
        </div>
      )}
      {content && (
        <div className="sea-ai-chat-customize-definition-content" dangerouslySetInnerHTML={{ __html: renderContent(content) }}></div>
      )}
    </div>
  );
};

export default Definition;
