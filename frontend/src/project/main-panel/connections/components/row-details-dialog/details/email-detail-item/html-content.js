import { isValidUrl } from '@/utils/validate';
import React, { useEffect, useRef } from 'react';

const HTMLContent = ({
  assetURLPrefix,
  className,
  value,
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleImgSrc = () => {
      if (!ref.current) return;
      const images = ref.current.querySelectorAll('img');
      images.forEach((img) => {
        const originalSrc = img.getAttribute('src');
        if (originalSrc && !img.hasAttribute('sea-data-processed') && !isValidUrl(originalSrc)) {
          img.setAttribute('sea-data-processed', 'true');
          const newSrc = `${assetURLPrefix}${originalSrc}`;
          img.removeAttribute('src');
          setTimeout(() => {
            img.setAttribute('src', newSrc);
          }, 0);
        }
      });
    };

    handleImgSrc();

    const observer = new MutationObserver(handleImgSrc);
    if (ref.current) {
      observer.observe(ref.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={className} ref={ref} dangerouslySetInnerHTML={{ __html: value }} />
  );
};

export default HTMLContent;
