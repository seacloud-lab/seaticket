import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

import './index.css';

const MessageImages = ({ images }) => {
  const [previewIndex, setPreviewIndex] = useState(-1);

  const onClose = useCallback(() => setPreviewIndex(-1), []);

  useEffect(() => {
    if (previewIndex < 0) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewIndex(-1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewIndex]);

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
            <img src={img._previewUrl || img.path} alt={img.name || ''} />
          </div>
        ))}
      </div>
      {previewIndex > -1 && ReactDOM.createPortal(
        <div
          className="sea-qa-ai-chat-message-image-lightbox"
          onClick={onClose}
          role="dialog"
          aria-label={gettext('Image preview')}
        >
          <img src={images[previewIndex]._previewUrl || images[previewIndex].path} alt={images[previewIndex].name || ''} />
        </div>,
        document.body
      )}
    </>
  );
};

MessageImages.propTypes = {
  images: PropTypes.array,
};

export default MessageImages;
