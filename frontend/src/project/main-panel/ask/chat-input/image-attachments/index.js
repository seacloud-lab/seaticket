import React from 'react';
import PropTypes from 'prop-types';
import { IconButton, Loading } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const ImageAttachments = ({ images, onRemove, onRetry }) => {
  if (!Array.isArray(images) || images.length === 0) return null;
  return (
    <div className="sea-qa-ai-chat-image-attachments">
      {images.map((img) => (
        <div key={img.id} className={`sea-qa-ai-chat-image-attachment status-${img.status}`} title={img.name}>
          <img src={img.previewUrl} alt={img.name} />
          {img.status === 'uploading' && (
            <div className="sea-qa-ai-chat-image-mask">
              <Loading />
            </div>
          )}
          {img.status === 'error' && (
            <div
              className="sea-qa-ai-chat-image-mask sea-qa-ai-chat-image-error"
              onClick={() => onRetry(img.id)}
              title={gettext('Upload failed, click to retry')}
            >
              !
            </div>
          )}
          <IconButton
            icon="close"
            className="sea-qa-ai-chat-image-remove no-hover-bg"
            onClick={() => onRemove(img.id)}
            aria-label={gettext('Remove')}
          />
        </div>
      ))}
    </div>
  );
};

ImageAttachments.propTypes = {
  images: PropTypes.array,
  onRemove: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
};

export default ImageAttachments;
