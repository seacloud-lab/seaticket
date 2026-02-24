import React, { useCallback, useMemo } from 'react';
import { ClearIconButton, Icon } from '@/components';
import { gettext } from '@/constants';
import { AttachmentObject } from '../../../models';

import './index.css';

const Attachment = ({ value, index, onRemove, openAttachment }) => {

  const attachment = useMemo(() => new AttachmentObject({ ...value }), [value]);

  const handleRemove = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    onRemove(attachment, index);
  }, [onRemove]);

  const onClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    openAttachment();
  }, [openAttachment]);

  const { icon, title } = attachment;

  return (
    <div className="sea-qa-ai-chat-attachment" onClick={onClick}>
      <Icon symbol={icon} className={`sea-qa-project-ticket-state-${icon}-icon sea-qa-project-ai-attachment-icon mr-2`} />
      <span className="text-truncate flex-1" title={title} aria-label={title}>{title}</span>
      {onRemove && (
        <ClearIconButton
          useTooltip={true}
          className="mr-0 ml-4"
          title={gettext('Remove')}
          onClick={handleRemove}
          placement="top"
        />
      )}
    </div>
  );
};

export default Attachment;
