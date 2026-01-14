import React, { useCallback, useMemo } from 'react';
import { IconTooltip, Icon } from '@/components';
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
