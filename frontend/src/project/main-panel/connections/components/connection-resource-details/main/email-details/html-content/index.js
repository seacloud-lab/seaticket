import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { isValidUrl } from '@/utils/validate';
import { generatorConnectionAssetURLPrefix } from '@/project/main-panel/connections/utils';
import { Utils } from '@/utils/utils';
import { IconButton, IconTextBtn } from '@/components';
import { gettext } from '@/constants';
import { downloadFile } from '@/utils/download';

import './index.css';

const HTMLContent = ({
  projectUuid,
  connection_id,
  className,
  value,
  detail
}) => {
  const ref = useRef(null);
  const assetURLPrefix = useMemo(() => generatorConnectionAssetURLPrefix(projectUuid, connection_id), [projectUuid, connection_id]);

  const handDownload = useCallback((url) => {
    downloadFile(url);
  }, []);

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

  const attachments = detail.attachments;

  return (
    <>
      <div className={className} ref={ref} dangerouslySetInnerHTML={{ __html: value }} />
      {Array.isArray(attachments) && attachments.length > 0 && (
        <div className="sea-ticket-email-attachments">
          {attachments.map((attachment, index) => {
            const url = `${assetURLPrefix}${detail._pk}/${attachment}`;
            return (
              <div className="sea-ticket-email-attachment">
                <div className="sea-ticket-email-attachment-icon">
                  <img
                    src={Utils.imageCheck(attachment) ? url : Utils.getFileIconUrl(attachment)}
                    alt=""
                    height={32}
                    width={32}
                  />
                </div>
                <div className="sea-ticket-email-attachment-info">
                  <a
                    className="sea-ticket-email-attachment-name"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {attachment}
                  </a>
                  {/* <div className="sea-ticket-email-attachment-size">{''}</div> */}
                </div>
                <div className="sea-ticket-email-attachment-divider"></div>
                <IconButton
                  icon="download"
                  title={gettext('Download')}
                  className="sea-ticket-email-attachment-download-btn no-hover-bg"
                  size={{ btn: 32, icon: 16 }}
                  onClick={() => handDownload(url)}
                />
              </div>
            );
          })}
        </div>
      )}
      {Array.isArray(attachments) && attachments.length > 1 && (
        <IconTextBtn
          icon="download"
          className="sea-ticket-email-attachments-download-btn"
          text={gettext('Download all {n} attachments').replace('{n}', attachments.length)}
        />
      )}
    </>
  );

};

export default HTMLContent;
