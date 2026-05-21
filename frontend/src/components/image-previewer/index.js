import React, { useCallback, useState } from 'react';
import Lightbox from '@seafile/react-image-lightbox';
import Title from './title';
import { gettext } from '@/constants';

import '@seafile/react-image-lightbox/style.css';

const ImagePreviewer = ({ index, images, onToggle }) => {
  const [imageIndex, setImageIndex] = useState(index);
  const mainSrc = images[imageIndex];

  const moveToPrevImage = useCallback(() => {
    const currentImageIndex = (imageIndex + images.length - 1) % images.length;
    setImageIndex(currentImageIndex);
  }, [imageIndex, images]);

  const moveToNextImage = useCallback(() => {
    const newImageIndex = (imageIndex + 1) % images.length;
    setImageIndex(newImageIndex);
  }, [imageIndex, images]);

  return (
    <Lightbox
      imageItems={images}
      currentIndex={imageIndex}
      setImageIndex={setImageIndex}
      wrapperClassName="sf-editor-image-previewer"
      imageTitle={<Title mainSrc={mainSrc} imageIndex={imageIndex} images={images} />}
      mainSrc={mainSrc}
      toolbarButtons={[]}
      nextSrc={images[(imageIndex + 1) % images.length]}
      prevSrc={images[(imageIndex + images.length - 1) % images.length]}
      onCloseRequest={onToggle}
      reactModalProps={{ shouldReturnFocusAfterClose: true, preventScroll: true }}
      onMovePrevRequest={moveToPrevImage}
      onMoveNextRequest={moveToNextImage}
      imagePadding={70}
      reactModalStyle={{
        overlay: {
          zIndex: 1071
        }
      }}
      zoomInTip={gettext('Zoom in')}
      zoomOutTip={gettext('Zoom out')}
    />
  );
};

export default ImagePreviewer;
