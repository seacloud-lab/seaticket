import React, { useCallback, useMemo } from 'react';
import { IconTooltip, Icon } from '@/components';
import classnames from 'classnames';
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
    <div className={classnames('sea-qa-ai-chat-attachment', { 'sea-qa-ai-chat-attachment-remove-able': onRemove })} onClick={onClick}>
      <Icon symbol={icon} className={`sea-qa-project-ticket-state-${icon}-icon sea-qa-project-ai-attachment-icon mr-2`} />
      <span className="text-truncate flex-1" title={title} aria-label={title}>{title}</span>
      {onRemove && (
        <IconTooltip
          hoverBackground={true}
          icon="close"
          className="mr-0 sea-qa-ai-chat-attachment-remove-btn"
          tip={gettext('Remove')}
          size={{ btn: 24, icon: 12 }}
          onClick={handleRemove}
          placement="top"
        />
      )}
    </div>
  );
};

export default Attachment;
