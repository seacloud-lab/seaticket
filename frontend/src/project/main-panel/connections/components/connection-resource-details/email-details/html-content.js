import React, { useEffect, useRef } from 'react';
import { isValidUrl } from '@/utils/validate';
import { generatorConnectionAssetURLPrefix } from '../../../utils';

const HTMLContent = ({
  projectUuid,
  connection_id,
  className,
  value,
  detail
}) => {
  const ref = useRef(null);
  const assetURLPrefix = generatorConnectionAssetURLPrefix(projectUuid, connection_id);

  useEffect(() => {
    const handleImgSrc = () => {
      if (!ref.current) return;
      const images = ref.current.querySelectorAll('img');
      images.forEach((img) => {
        const originalSrc = img.getAttribute('src');
        if (originalSrc && !originalSrc.startsWith('data:image') && !img.hasAttribute('sea-data-processed') && !isValidUrl(originalSrc)) {
          img.setAttribute('sea-data-processed', 'true');
          const newSrc = `${assetURLPrefix}${detail._pk}/${originalSrc}`;
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

  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const HTMLContentBody = parsed.body;
  const content = HTMLContentBody.outerHTML;

  return (
    <div>
      <div className={className} ref={ref} dangerouslySetInnerHTML={{ __html: content }} />
      <ul>
        {detail.attachments && detail.attachments.map((filename, index) => {
          let url = `${assetURLPrefix}${detail._pk}/${filename}`;
          const file_name = filename.indexOf('_') === -1 ? filename : filename.slice(filename.indexOf('_') + 1);
          return (
            <li key={`download-${index}-${filename}`}>
              <a
                href={url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="download-link"
              >
                {file_name}
              </a>
            </li>
          );
        })}
      </ul>

    </div>
  );

};

export default HTMLContent;
