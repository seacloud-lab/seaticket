import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAndCleanHTML } from '@seafile/sea-email-editor/dist/utils/dom';
import { IconButton, IconTextBtn, toaster } from '@/components';
import { gettext, server, siteRoot } from '@/constants';
import { portalAPI } from '@/portal/api';
import { connectionsAPI } from '@/project/api';
import { generatorConnectionAssetURLPrefix } from '@/project/main-panel/connections/utils';
import { downloadFile } from '@/utils/download';
import { isString } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { isValidEmail, isValidUrl } from '@/utils/validate';
import './index.css';

const HTMLContent = ({
  projectUuid,
  connectionId,
  recordId,
  className,
  value,
  detail,
  isReadonly,
  openReplyByEmail,
  isPortal = false,
  threadId,
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const ref = useRef(null);
  const downloadAllTimer = useRef(null);
  const isUnmounted = useRef(false);
  const imageTimersRef = useRef([]);

  const assetURLPrefix = useMemo(() => isPortal
    ? `${siteRoot}api/v1/portal/${projectUuid}/emails/${connectionId}/${threadId}/${recordId}/attachments/`
    : generatorConnectionAssetURLPrefix(projectUuid, connectionId), [isPortal, projectUuid, connectionId, threadId, recordId]);
  const assetFilePrefix = isPortal ? '' : `${detail._pk}/`;
  const content = useMemo(() => {
    const HTMLContentBody = parseAndCleanHTML(value);
    return HTMLContentBody.innerHTML;
  }, [value]);
  const attachments = useMemo(() => Array.isArray(detail.attachments) ? detail.attachments : [], [detail.attachments]);
  const getAttachmentURL = useCallback((attachmentName, download = false) => {
    if (!attachmentName) return '';
    const url = `${assetURLPrefix}${assetFilePrefix}${encodeURIComponent(attachmentName)}`;
    return download ? `${url}?download=1` : url;
  }, [assetURLPrefix, assetFilePrefix]);

  const handDownload = useCallback((url) => {
    downloadFile(url);
  }, []);

  const handDownloadAll = useCallback(() => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    if (isPortal) {
      portalAPI.zipPortalEmailAttachments(projectUuid, connectionId, threadId, recordId).then((res) => {
        if (isUnmounted.current) return;
        const taskId = res.data.task_id;
        const pollTaskStatus = () => {
          if (isUnmounted.current) return;
          portalAPI.getPortalEmailAttachmentsZipStatus(projectUuid, connectionId, threadId, recordId, taskId).then((statusResponse) => {
            if (isUnmounted.current) return;
            if (statusResponse.data?.is_finished) {
              downloadAllTimer.current = null;
              downloadFile(portalAPI.getPortalEmailAttachmentsZipDownloadURL(projectUuid, connectionId, threadId, recordId));
              setIsDownloadingAll(false);
              return;
            }
            downloadAllTimer.current = setTimeout(pollTaskStatus, 1000);
          }).catch((error) => {
            downloadAllTimer.current = null;
            if (isUnmounted.current) return;
            setIsDownloadingAll(false);
            toaster.danger(Utils.getErrorMsg(error));
          });
        };
        downloadAllTimer.current = setTimeout(pollTaskStatus, 1000);
      }).catch((error) => {
        if (isUnmounted.current) return;
        setIsDownloadingAll(false);
        toaster.danger(Utils.getErrorMsg(error));
      });
      return;
    }
    connectionsAPI.zipEmailAttachments(projectUuid, connectionId, recordId).then(res => {
      if (isUnmounted.current) return;
      const taskId = res.data.task_id;
      const pollTaskStatus = () => {
        if (isUnmounted.current) return;
        connectionsAPI.queryTaskStatus(taskId).then(res => {
          if (isUnmounted.current) return;
          if (res.data && res.data.is_finished === true) {
            downloadAllTimer.current = null;
            const url = `${server}${siteRoot}api/v1/project/${projectUuid}/connections/${connectionId}/email/${recordId}/download-attachments/`;
            downloadFile(url);
            setIsDownloadingAll(false);
            downloadAllTimer.current = null;
            return;
          }
          downloadAllTimer.current = setTimeout(pollTaskStatus, 1000);
        }).catch(error => {
          downloadAllTimer.current = null;
          if (isUnmounted.current) return;
          setIsDownloadingAll(false);
          const errMessage = Utils.getErrorMsg(error);
          toaster.danger(errMessage);
        });
      };

      downloadAllTimer.current = setTimeout(pollTaskStatus, 1000);
    }).catch((error) => {
      if (isUnmounted.current) return;
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
  }, [isDownloadingAll, projectUuid, connectionId, recordId, threadId, isPortal]);

  const handleClick = useCallback((event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a');
    if (!link || !ref.current?.contains(link)) return;
    const href = link.getAttribute('href') || '';
    if (!href) return;
    if (!href.startsWith('mailto:')) return;
    const email = href.slice(7);
    if (!isValidEmail(email)) return;
    event.preventDefault();
    openReplyByEmail(email);
  }, [openReplyByEmail]);

  useEffect(() => {
    const handleImgSrc = () => {
      if (!ref.current) return;
      const images = ref.current.querySelectorAll('img');
      images.forEach((img) => {
        const originalSrc = img.getAttribute('src');
        if (originalSrc && !originalSrc.startsWith('data:image') && !img.hasAttribute('sea-data-processed') && !isValidUrl(originalSrc)) {
          img.setAttribute('sea-data-processed', 'true');
          const newSrc = `${assetURLPrefix}${assetFilePrefix}${originalSrc}`;
          img.removeAttribute('src');
          const timer = setTimeout(() => {
            if (isUnmounted.current) return;
            img.setAttribute('src', newSrc);
          }, 0);
          imageTimersRef.current.push(timer);
        }
      });
    };

    const decorateMailtoLinks = () => {
      if (!ref.current) return;
      const links = ref.current.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.startsWith('mailto:') && isValidEmail(href.slice(7))) {
          const email = href.slice(7);
          link.setAttribute('title', `${gettext('Send email to')} ${email}`);
        }
      });
    };

    handleImgSrc();
    decorateMailtoLinks();

    const imgObserver = new MutationObserver(handleImgSrc);
    const linkObserver = new MutationObserver(decorateMailtoLinks);
    if (ref.current) {
      imgObserver.observe(ref.current, {
        childList: true,
        subtree: true,
      });
      linkObserver.observe(ref.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      imageTimersRef.current.forEach(timer => clearTimeout(timer));
      imageTimersRef.current = [];
      imgObserver.disconnect();
      linkObserver.disconnect();
    };
  }, [assetURLPrefix, assetFilePrefix]);

  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      imageTimersRef.current.forEach(timer => clearTimeout(timer));
      imageTimersRef.current = [];
      if (!downloadAllTimer.current) return;
      clearTimeout(downloadAllTimer.current);
      downloadAllTimer.current = null;
    };
  }, []);

  const downloadAllTip = gettext('{download} all {n} attachments')
    .replace('{download}', isDownloadingAll ? gettext('Downloading') : gettext('Download'))
    .replace('{n}', attachments.length);

  return (
    <>
      <div className={className} ref={ref} dangerouslySetInnerHTML={{ __html: content }} onClick={handleClick} />
      {attachments.length > 0 && (
        <div className="seaqa-email-attachments">
          {attachments.map((attachment, index) => {
            const attachmentName = isString(attachment) ? attachment : '';
            const url = getAttachmentURL(attachmentName);
            const downloadUrl = getAttachmentURL(attachmentName, true);
            const Tag = isReadonly && !isPortal ? 'span' : 'a';
            const canDownload = (!isReadonly || isPortal) && Boolean(url);
            return (
              <div className="seaqa-email-attachment" key={index}>
                <div className="seaqa-email-attachment-icon">
                  <img
                    src={attachmentName && Utils.imageCheck(attachmentName) ? url : Utils.getFileIconUrl(attachmentName)}
                    alt=""
                    height={32}
                    width={32}
                  />
                </div>
                <div className="seaqa-email-attachment-info">
                  <Tag
                    className="seaqa-email-attachment-name"
                    href={canDownload ? downloadUrl : undefined}
                    download={canDownload ? attachmentName : undefined}
                  >
                    {attachmentName || gettext('Unnamed attachment')}
                  </Tag>
                  {/* <div className="seaqa-email-attachment-size">{''}</div> */}
                </div>
                <div className="seaqa-email-attachment-divider"></div>
                {canDownload && (
                  <IconButton
                    icon="download"
                    title={gettext('Download')}
                    className="seaqa-email-attachment-download-btn no-hover-bg"
                    size={{ btn: 32, icon: 16 }}
                    onClick={() => handDownload(downloadUrl)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {(!isReadonly || isPortal) && attachments.length > 1 && (
        <IconTextBtn
          icon={isDownloadingAll ? '' : 'download'}
          className="seaqa-email-attachments-download-btn"
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
