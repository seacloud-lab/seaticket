import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';
import { gettext } from '@/constants';
import { removeTextMark } from '@/utils/remove-text-mark';

import './index.css';

const Definition = ({ element, attributes, editor, openDefinitionRecord, onClick, sources }) => {

  const source = useMemo(() => {
    if (!element) return {};
    if (!Array.isArray(sources) || sources.length === 0) return {};
    const identifier = Number(element.identifier);
    const sourceIndex = identifier - 1;
    return { ...sources[sourceIndex], identifier: identifier };
  }, [element, sources]);

  const handleClick = useCallback((event) => {
    openDefinitionRecord && openDefinitionRecord(event, source);
  }, [source, onClick, openDefinitionRecord]);

  if (!element) return null;

  const { identifier, icon, title, content, mtime } = source;

  const identifierIndex = identifier - 1;

  return (
    <div
      className={classnames('sea-ai-chat-customize-definition', { 'ml-0': identifierIndex % 3 === 0 })}
      onClick={handleClick}
      data-id={element.id}
      { ...attributes }
    >
      <div className="sea-ai-chat-customize-definition-simple-info">
        <div className="sea-ai-chat-customize-definition-title-content">
          <div className="sea-ai-chat-customize-definition-title">{title}</div>
        </div>
      </div>
      {content && (
        <div className="sea-ai-chat-customize-definition-content">
          {removeTextMark(content)}
        </div>
      )}
      <div className="sea-ai-chat-customize-definition-content-divider"></div>
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <div className="sea-ai-chat-customize-definition-avatar d-flex align-items-center justify-content-center">
            <img src={icon} alt={''} />
          </div>
          {(mtime) && (
            <div className="sea-ai-chat-customize-definition-mtime text-truncate" title={formatWithTimezone(mtime)}>
              {`${gettext('Updated')} ${dayjs(mtime).fromNow()}`}
            </div>
          )}
        </div>
        <div className="sea-ai-chat-customize-definition-order">{identifier}</div>
      </div>
    </div>
  );
};

export default Definition;
