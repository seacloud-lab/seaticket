import React, { useCallback, useMemo } from 'react';
import classnames from 'classnames';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import dayjs from 'dayjs';
import { gettext } from '@/constants';
import { removeTextMark } from '@/utils/remove-text-mark';

import './index.css';

const Definition = ({ element, attributes, editor, openDefinitionRecord, onClick, sources, disableAutoWidth = false }) => {

  const source = useMemo(() => {
    if (!element) return {};
    if (!Array.isArray(sources) || sources.length === 0) return {};
    const identifier = Number(element.identifier);
    const sourceIndex = identifier - 1;
    return { ...sources[sourceIndex], identifier: identifier };
  }, [element, sources]);

  const handleClick = useCallback((event) => {
    openDefinitionRecord && openDefinitionRecord(event, source);
  }, [source, openDefinitionRecord]);

  const definitionWidth = useMemo(() => {
    // 48px is the width of the more definition button (margin + button width)
    const offsetWidth = sources.length > 3 ? '48px' : '0px';
    return `calc((100% - 16px - ${offsetWidth}) / 3)`;
  }, [sources]);

  if (!element) return null;

  const { identifier, icon, title, content, mtime } = source;

  const identifierIndex = identifier - 1;
  const definitionStyle = disableAutoWidth ? undefined : { width: definitionWidth };

  return (
    <div
      className={classnames('seaqa-ai-chat-customize-definition', { 'ml-0': identifierIndex % 3 === 0 })}
      style={definitionStyle}
      onClick={handleClick}
      data-id={element.id}
      { ...attributes }
    >
      <div className="seaqa-ai-chat-customize-definition-simple-info">
        <div className="seaqa-ai-chat-customize-definition-title-content">
          <div className="seaqa-ai-chat-customize-definition-title">{title}</div>
        </div>
      </div>
      <div className="seaqa-ai-chat-customize-definition-content">
        {removeTextMark(content)}
      </div>
      <div className="seaqa-ai-chat-customize-definition-content-divider"></div>
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center flex-1 o-hidden">
          <div className="seaqa-ai-chat-customize-definition-avatar d-flex align-items-center justify-content-center flex-shrink-0">
            <img src={icon} alt="" />
          </div>
          {(mtime) && (
            <div className="seaqa-ai-chat-customize-definition-mtime text-truncate flex-1" title={formatWithTimezone(mtime)}>
              {`${gettext('Updated')} ${dayjs(mtime).fromNow()}`}
            </div>
          )}
        </div>
        <div className="seaqa-ai-chat-customize-definition-order">{identifier}</div>
      </div>
    </div>
  );
};

export default Definition;
