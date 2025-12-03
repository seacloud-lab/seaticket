import React, { useCallback } from 'react';
import { IconTooltip, Icon } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const ToolsFormatter = ({ value = [], onRemove }) => {

  const handleRemove = useCallback((event, item) => {
    event.stopPropagation();
    onRemove(item);
  }, [onRemove]);

  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <div className="w-100 px-4 o-hidden">
      <div className="sea-qa-ai-chat-tools-formatter">
        {value.map(item => {
          const { icon = 'all-tickets', title } = item;
          return (
            <div className="sea-qa-ai-chat-tool">
              <Icon symbol={icon} className={`sea-qa-project-ticket-state-${icon}-icon mr-2`} />
              <span className="text-truncate flex-1" title={title} aria-label={title}>{title}</span>
              <IconTooltip
                icon="x"
                className="sea-qa-ai-chat-tool-remove"
                tip={gettext('Remove')}
                placement="bottom"
                onClick={(event) => handleRemove(event, item)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolsFormatter;
