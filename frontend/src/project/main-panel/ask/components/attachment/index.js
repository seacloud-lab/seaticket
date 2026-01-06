import React, { useCallback, useMemo } from 'react';
import { IconTooltip, Icon } from '@/components';
import { gettext } from '@/constants';
import { generatorTicketURL } from '@/project/main-panel/tickets/utils';
import { generatorKnowledgeBaseURL } from '@/project/main-panel/knowledge-base/utils';
import { workspaceID, projectName } from '@/constants';
import { AttachmentObject } from '../../models';

import './index.css';

const Attachment = ({ value, index, onRemove }) => {

  const attachment = useMemo(() => new AttachmentObject({ ...value }), [value]);

  const handleRemove = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRemove(attachment, index);
  }, [onRemove]);

  const onClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    let url = '';
    if (attachment.type === 'ticket') {
      url = generatorTicketURL({ row: attachment, workspaceID, projectName });
    } else if (attachment.type === 'knowledge_base') {
      url = generatorKnowledgeBaseURL({ row: attachment, workspaceID, projectName });
    }
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [attachment]);

  const { icon, title } = attachment;

  return (
    <div className="sea-qa-ai-chat-attachment" onClick={onClick}>
      <Icon symbol={icon} className={`sea-qa-project-ticket-state-${icon}-icon sea-qa-project-ai-attachment-icon mr-2`} />
      <span className="text-truncate flex-1" title={title} aria-label={title}>{title}</span>
      {onRemove && (
        <IconTooltip
          icon="close"
          className="sea-qa-ai-chat-attachment-remove"
          tip={gettext('Remove')}
          placement="bottom"
          onClick={handleRemove}
        />
      )}
    </div>
  );
};

export default Attachment;
