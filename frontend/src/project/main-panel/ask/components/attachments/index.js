import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import Attachment from './attachment';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { hasOwnProperty } from '@/utils/object-utils';

import './index.css';

const Attachments = ({
  projectUuid,
  attachments,
  className,
  innerRef,
  onRemove,
  ...props
}) => {
  const [attachmentIndex, setAttachmentIndex] = useState(-1);

  const openAttachment = useCallback((attachmentIndex) => {
    setAttachmentIndex(attachmentIndex);
  }, []);

  const switchResource = useCallback((step) => {
    let nextAttachmentIndex = attachmentIndex + step;
    if (nextAttachmentIndex > attachments.length - 1) {
      nextAttachmentIndex = 0;
    }
    if (nextAttachmentIndex < 0) {
      nextAttachmentIndex = attachments.length - 1;
    }
    setAttachmentIndex(nextAttachmentIndex);
  }, [attachmentIndex, attachments]);

  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  let activeAttachment = null;
  if (attachmentIndex > -1) {
    activeAttachment = attachments[attachmentIndex];
    if (!hasOwnProperty(activeAttachment, '_id')) {
      activeAttachment._id = activeAttachment.record_id;
    }
  }

  return (
    <>
      <div className={classnames('sea-qa-ai-chat-message-attachments', className)} ref={innerRef} { ...props }>
        {attachments.map((attachment, index) => {
          return (
            <Attachment
              value={attachment}
              index={index}
              key={index}
              onRemove={onRemove}
              openAttachment={() => openAttachment(index)}
            />
          );
        })}
      </div>
      {attachmentIndex > -1 && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={activeAttachment}
          isShowIcon={true}
          switchResource={attachments.length > 1 ? switchResource : null}
          onToggle={() => setAttachmentIndex(-1)}
        />
      )}
    </>
  );
};

export default Attachments;
