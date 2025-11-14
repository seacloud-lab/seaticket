import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { getPreviewContent } from '@seafile/seafile-editor';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';
import { gettext } from '@/constants';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES } from '../../../connections/constants';

import './index.css';

const Definition = ({ element, attributes, editor, openDefinitionRecord, onClick, sources, settings }) => {
  const isShowScore = useMemo(() => settings?.developer_mode, [settings]);

  const source = useMemo(() => {
    if (!element) return {};
    if (!Array.isArray(sources) || sources.length === 0) return {};
    const identifier = Number(element.identifier);
    const sourceIndex = identifier - 1;
    return { ...sources[sourceIndex], identifier: identifier };
  }, [element, sources]);

  const renderContent = useCallback((content) => {
    const isMarkdown = true;
    const previewTextNeedSlice = false;
    const { previewText } = getPreviewContent(content, isMarkdown, previewTextNeedSlice);
    return previewText;
  }, []);

  const handleClick = useCallback((event) => {
    const { type } = source;
    if (SUPPORT_ROW_DETAILS_CONNECTION_TYPES.includes(type)) {
      openDefinitionRecord && openDefinitionRecord(event, source);
      return;
    }
    onClick && onClick(event);
  }, [source, onClick, openDefinitionRecord]);

  if (!element) return null;

  const { identifier, icon, connection_name, content, mtime, score } = source;

  const identifierIndex = identifier - 1;

  return (
    <div
      className={classnames('sea-ai-chat-customize-definition', { 'ml-0': identifierIndex % 3 === 0 })}
      onClick={handleClick}
      data-id={element.id}
      { ...attributes }
    >
      <div className="sea-ai-chat-customize-definition-simple-info">
        <div className="sea-ai-chat-customize-definition-order">{identifier}</div>
        <div className="sea-ai-chat-customize-definition-title-score">
          <div className="sea-ai-chat-customize-definition-title text-truncate">{connection_name}</div>
          {isShowScore && (
            <div className="sea-ai-chat-customize-definition-score">{score}</div>
          )}
        </div>
        <div className="sea-ai-chat-customize-definition-avatar">
          <img src={icon} alt={connection_name} />
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
