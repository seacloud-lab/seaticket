import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isValidUrl } from '@/utils/validate';
import { generatorConnectionAssetURLPrefix } from '@/project/main-panel/connections/utils';
import { Utils } from '@/utils/utils';
import { IconButton, IconTextBtn, toaster } from '@/components';
import { gettext, server, siteRoot } from '@/constants';
import { downloadFile } from '@/utils/download';
import { connectionsAPI } from '@/project/api';

import './index.css';

const HTMLContent = ({
  projectUuid,
  connectionId,
  recordId,
  className,
  value,
  detail,
  isReadonly,
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const ref = useRef(null);
  const downloadAllTimer = useRef(null);
  const queryComplete = useRef(false);

  const assetURLPrefix = useMemo(() => generatorConnectionAssetURLPrefix(projectUuid, connectionId), [projectUuid, connectionId]);

  const handDownload = useCallback((url) => {
    downloadFile(url);
  }, []);

  const handDownloadAll = useCallback(() => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    connectionsAPI.zipEmailAttachments(projectUuid, connectionId, recordId).then(res => {
      const taskId = res.data.task_id;
      downloadAllTimer.current = setInterval(() => {
        if (queryComplete.current) return;
        queryComplete.current = true;
        connectionsAPI.queryTaskStatus(taskId).then(res => {
          queryComplete.current = false;
          if (res.data && res.data.is_finished === true) {
            clearInterval(downloadAllTimer.current);
            downloadAllTimer.current = null;
            const url = `${server}${siteRoot}api/v1/project/${projectUuid}/connections/${connectionId}/email/${recordId}/download-attachments/`;
            downloadFile(url);
            setIsDownloadingAll(false);
          }
        }).catch(error => {
          clearInterval(downloadAllTimer.current);
          downloadAllTimer.current = null;
          queryComplete.current = false;
          setIsDownloadingAll(false);
          const errMessage = Utils.getErrorMsg(error);
          toaster.danger(errMessage);
        });
      }, 1000);
    }).catch((error) => {
      setIsDownloadingAll(false);
      if (error.response && error.response.status === 500) {
        toaster.danger(gettext('Internal server error'));
      } else {
        const errMsg = Utils.getErrorMsg(error, true);
        if (!error.response || error.response.status !== 403) {
          toaster.danger(errMsg);
        }
      }
    });
  }, [isDownloadingAll, projectUuid, connectionId, recordId]);

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

  useEffect(() => {
    return () => {
      if (!downloadAllTimer.current) return;
      clearInterval(downloadAllTimer.current);
      downloadAllTimer.current = null;
    };
  }, []);

  const attachments = detail.attachments;
  const downloadAllTip = gettext('{download} all {n} attachments')
    .replace('{download}', isDownloadingAll ? gettext('Downloading') : gettext('Download'))
    .replace('{n}', attachments.length);

  return (
    <>
      <div className={className} ref={ref} dangerouslySetInnerHTML={{ __html: value }} />
      {Array.isArray(attachments) && attachments.length > 0 && (
        <div className="sea-ticket-email-attachments">
          {attachments.map((attachment, index) => {
            const url = `${assetURLPrefix}${detail._pk}/${attachment}`;
            const Tag = isReadonly ? 'span' : 'a';
            return (
              <div className="sea-ticket-email-attachment" key={index}>
                <div className="sea-ticket-email-attachment-icon">
                  <img
                    src={Utils.imageCheck(attachment) ? url : Utils.getFileIconUrl(attachment)}
                    alt=""
                    height={32}
                    width={32}
                  />
                </div>
                <div className="sea-ticket-email-attachment-info">
                  <Tag
                    className="sea-ticket-email-attachment-name"
                    href={isReadonly ? '' : url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {attachment}
                  </Tag>
                  {/* <div className="sea-ticket-email-attachment-size">{''}</div> */}
                </div>
                <div className="sea-ticket-email-attachment-divider"></div>
                {!isReadonly && (
                  <IconButton
                    icon="download"
                    title={gettext('Download')}
                    className="sea-ticket-email-attachment-download-btn no-hover-bg"
                    size={{ btn: 32, icon: 16 }}
                    onClick={() => handDownload(url)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {!isReadonly && Array.isArray(attachments) && attachments.length > 1 && (
        <IconTextBtn
          icon={isDownloadingAll ? '' : 'download'}
          className="sea-ticket-email-attachments-download-btn"
          text={downloadAllTip}
          disabled={isDownloadingAll}
          isLoading={isDownloadingAll}
          onClick={handDownloadAll}
        />
      )}
    </>
  );

};

export default HTMLContent;
