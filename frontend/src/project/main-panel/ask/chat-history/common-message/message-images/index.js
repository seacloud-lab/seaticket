import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

import './index.css';

const MessageImages = ({ images }) => {
  const [previewIndex, setPreviewIndex] = useState(-1);

  const onClose = useCallback(() => setPreviewIndex(-1), []);

  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <>
      <div className="sea-qa-ai-chat-message-images">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="sea-qa-ai-chat-message-image"
            onClick={() => setPreviewIndex(idx)}
            title={img.name || ''}
          >
            <img src={img.url} alt={img.name || ''} />
          </div>
        ))}
      </div>
      {previewIndex > -1 && (
        <div
          className="sea-qa-ai-chat-message-image-lightbox"
          onClick={onClose}
          role="dialog"
          aria-label={gettext('Image preview')}
        >
          <img src={images[previewIndex].url} alt={images[previewIndex].name || ''} />
        </div>
      )}
    </>
  );
};

MessageImages.propTypes = {
  images: PropTypes.array,
};

export default MessageImages;
