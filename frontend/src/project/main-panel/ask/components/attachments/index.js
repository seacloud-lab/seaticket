import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import Attachment from './attachment';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { hasOwnProperty } from '@/utils/object-utils';
import { CHAT_ATTACHMENT_TYPE } from '../../constants';
import { ImagePreviewer } from '@/components';
import { AttachmentObject } from '../../models';

import './index.css';

const Attachments = ({
  projectUuid,
  attachments: propsAttachments,
  className,
  innerRef,
  onRemove,
  onReupload,
  ...props
}) => {
  const [attachmentIndex, setAttachmentIndex] = useState(-1);
  const [imageAttachmentIndex, setImageAttachmentIndex] = useState(-1);

  const attachments = useMemo(() => {
    if (!Array.isArray(propsAttachments) || propsAttachments.length === 0) return [];
    return propsAttachments.filter(Boolean).map(att => att instanceof AttachmentObject ? att : new AttachmentObject(att));
  }, [propsAttachments]);

  const { imageAttachments, otherAttachments } = useMemo(() => {
    let imageAttachments = [];
    let otherAttachments = [];
    attachments.forEach(attachment => {
      if (attachment.type === CHAT_ATTACHMENT_TYPE.IMAGE) {
        imageAttachments.push(attachment);
      } else {
        otherAttachments.push(attachment);
      }
    });
    return { imageAttachments, otherAttachments };
  }, [attachments]);

  const openAttachment = useCallback((attachment) => {
    if (attachment.type === CHAT_ATTACHMENT_TYPE.IMAGE) {
      const index = imageAttachments.findIndex(otherAttachment => otherAttachment.key === attachment.key);
      setImageAttachmentIndex(index);
      return;
    }
    const index = otherAttachments.findIndex(otherAttachment => otherAttachment.key === attachment.key);
    setAttachmentIndex(index);
  }, [imageAttachments, otherAttachments]);

  const switchResource = useCallback((step) => {
    let nextAttachmentIndex = attachmentIndex + step;
    if (nextAttachmentIndex > otherAttachments.length - 1) {
      nextAttachmentIndex = 0;
    }
    if (nextAttachmentIndex < 0) {
      nextAttachmentIndex = otherAttachments.length - 1;
    }
    setAttachmentIndex(nextAttachmentIndex);
  }, [attachmentIndex, otherAttachments]);

  if (attachments.length === 0) return null;

  let activeAttachment = null;
  if (attachmentIndex > -1) {
    activeAttachment = otherAttachments[attachmentIndex];
    if (!hasOwnProperty(activeAttachment, '_id')) {
      activeAttachment._id = activeAttachment.record_id;
    }
  }

  return (
    <>
      <div
        className={classnames('seaqa-ai-chat-message-attachments', className)}
        ref={innerRef}
        { ...props }
      >
        {attachments.map((attachment, index) => {
          return (
            <Attachment
              attachment={attachment}
              index={index}
              key={attachment.key}
              isShowBigImage={attachments.length === 1 && imageAttachments.length === 1 && !onRemove}
              onRemove={onRemove}
              onReupload={onReupload}
              openAttachment={() => openAttachment(attachment)}
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
      {imageAttachmentIndex > -1 && (
        <ImagePreviewer
          index={imageAttachmentIndex}
          images={imageAttachments.map(item => item.preview_path || item.path)}
          onToggle={(event) => {
            event.preventDefault();
            setImageAttachmentIndex(-1);
          }}
        />
      )}
    </>
  );
};

export default Attachments;
