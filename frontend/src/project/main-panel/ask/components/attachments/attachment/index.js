import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconTooltip, Icon, CenteredLoading, IconButton } from '@/components';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { CHAT_ATTACHMENT_TYPE } from '../../../constants';

import './index.css';

const Attachment = ({ attachment, index, isShowBigImage, onRemove, onReupload, openAttachment }) => {
  const [imageStyle, setImageStyle] = useState({ height: 64, width: 64 });

  const imageRef = useRef(null);

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

  useEffect(() => {
    if (attachment.type !== CHAT_ATTACHMENT_TYPE.IMAGE || !isShowBigImage || !imageRef.current) return;
    const getOriginalSize = () => {
      const width = imageRef.current.naturalWidth;
      const height = imageRef.current.naturalHeight;
      if (width >= height) {
        if (width >= 240) {
          setImageStyle({ width: 240, height: height * (240 / width) });
          return;
        }
        if (width <= 64) return;
      } else {
        if (height >= 240) {
          setImageStyle({ height: 240, width: width * (240 / height) });
          return;
        }
        if (height <= 64) return;
      }
      setImageStyle({ width, height });
    };
    if (imageRef.current.complete) {
      getOriginalSize();
      return;
    }
    imageRef.current.addEventListener('load', getOriginalSize);
    return () => {
      imageRef.current && imageRef.current.removeEventListener('load', getOriginalSize);
    };
  }, [isShowBigImage, attachment.type, attachment.path]);

  if (attachment.type === CHAT_ATTACHMENT_TYPE.IMAGE) {
    const { status, preview_path, path, image } = attachment;
    return (
      <div
        className={classnames('seaqa-ai-chat-attachment image', { 'seaqa-ai-chat-attachment-remove-able': onRemove, 'failed': status === 'failed' })}
        onClick={status === 'done' ? onClick : () => {}}
        style={isShowBigImage ? imageStyle : {}}
      >
        <img src={preview_path || path} ref={imageRef} alt={gettext('Image')} className="seaqa-ai-chat-attachment-img" />
        {onRemove && status !== 'uploading' && (
          <IconTooltip
            hoverBackground={false}
            icon="close"
            className="mr-0 seaqa-ai-chat-attachment-remove-btn"
            tip={gettext('Remove')}
            size={{ btn: 16, icon: 8 }}
            onClick={handleRemove}
            placement="top"
          />
        )}
        {status === 'uploading' && (
          <div className="seaqa-ai-chat-attachment-uploading">
            <CenteredLoading />
          </div>
        )}
        {status === 'failed' && (
          <div className="seaqa-ai-chat-attachment-upload-failed">
            {onReupload && image && (<IconButton size={16} icon="refresh" className="no-hover-bg" onClick={() => onReupload(attachment)} />)}
            <span className="seaqa-ai-chat-attachment-upload-failed-tip">{gettext('Failed')}</span>
          </div>
        )}
      </div>
    );
  }

  const { icon, title, type_name } = attachment;

  return (
    <div className={classnames('seaqa-ai-chat-attachment', { 'seaqa-ai-chat-attachment-remove-able': onRemove })} onClick={onClick}>
      <div className="seaqa-ai-chat-attachment-name text-truncate" title={title} aria-label={title}>{title}</div>
      <div className="seaqa-ai-chat-attachment-type-info text-truncate" title={type_name}>
        <Icon symbol={icon} className={`seaqa-project-ticket-state-${icon}-icon seaqa-project-ai-attachment-icon mr-1`} />
        <span>{type_name}</span>
      </div>
      {onRemove && (
        <IconTooltip
          hoverBackground={false}
          icon="close"
          className="mr-0 seaqa-ai-chat-attachment-remove-btn"
          tip={gettext('Remove')}
          size={{ btn: 16, icon: 8 }}
          onClick={handleRemove}
          placement="top"
        />
      )}
    </div>
  );
};

export default Attachment;
