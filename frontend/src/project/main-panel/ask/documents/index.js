import React, { useCallback, useState } from 'react';
import { Dropdown } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import JSZip from 'jszip';
import { useDocuments } from '../hooks';
import {
  IconButton, CustomizeDropdownMoreToggle, CustomizeDropdownMenu,
  CustomizeDropdownItem, CustomizeDropdownItemText,
  CustomizeMarkdownViewer,
  toaster,
} from '@/components';
import { gettext } from '@/constants';
import { downloadBlobByA, downloadContentByA } from '@/utils/download';
import { Utils } from '@/utils/utils';

import './index.css';

const Documents = () => {
  const { isShowDocuments, documents, currentDocument, openDocument, closeDocument, closeDocuments, clear } = useDocuments();
  const [isFull, setIsFull] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);

  const toggleMoreMenu = useCallback(() => {
    !setIsMoreMenuShow(!isMoreMenuShow);
  }, [isMoreMenuShow]);

  const handleToggleCurrentDocument = useCallback((event, document) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    openDocument(document);
  }, [openDocument]);

  const handleDownLoadAll = useCallback(async () => {
    const zip = new JSZip();
    let documentNameCount = {};

    documents.forEach(document => {
      const documentName = document.name;
      if (!documentNameCount[documentName]) {
        documentNameCount[documentName] = 0;
      }
      const documentsCount = documentNameCount[documentName] + 1;
      documentNameCount[documentName] = documentsCount;
      zip.file(documentsCount > 1 ? `${documentName}(${documentsCount - 1})` : documentName, document.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlobByA(blob, 'files.zip');
  }, [documents]);

  const handleCloseDocument = useCallback((event, document) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    closeDocument(document);
  }, [closeDocument]);

  const handleCopyCurrentDocument = useCallback(() => {
    const { content } = currentDocument;
    copy(content);
    toaster.success(gettext('Markdown copied'));
  }, [currentDocument]);

  const handleDownloadCurrentDocument = useCallback(() => {
    const { name, content } = currentDocument;
    downloadContentByA(content, name, () => {
      toaster.success(gettext('Markdown downloaded'));
    });
  }, [currentDocument]);

  if (!isShowDocuments) return null;
  if (!Array.isArray(documents) || documents.length === 0) return null;

  const { content } = currentDocument;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const size = Utils.bytesToSize(blob.size);

  return (
    <div className={classnames('sea-ticket-chat-documents-wrapper', { 'w-100': isFull, 'pl-0': !isFull })}>
      <div className="sea-ticket-chat-documents">
        <div className="sea-ticket-chat-documents-header">
          <div className="sea-ticket-chat-documents-header-names">
            {documents.map(document => {
              const isSelected = document.url === currentDocument.url;
              return (
                <div
                  className={classnames('sea-ticket-chat-document-name-content', { 'active': isSelected })}
                  onClick={(event) => handleToggleCurrentDocument(event, document)}
                >
                  <span className="sea-ticket-chat-document-name text-truncate">{document.name}</span>
                  <IconButton className="sea-ticket-chat-document-name-btn" icon="x" onClick={(event) => handleCloseDocument(event, document)} title={gettext('Close')} />
                </div>
              );
            })}
          </div>
          <div className="sea-ticket-chat-documents-header-btns">
            <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu} className="d-flex">
              <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} className="ml-0" />
              <CustomizeDropdownMenu>
                <CustomizeDropdownItem onClick={handleDownLoadAll}>
                  <CustomizeDropdownItemText>{gettext('Download all files')}</CustomizeDropdownItemText>
                </CustomizeDropdownItem>
                <CustomizeDropdownItem onClick={clear}>
                  <CustomizeDropdownItemText>{gettext('Close all tabs')}</CustomizeDropdownItemText>
                </CustomizeDropdownItem>
              </CustomizeDropdownMenu>
            </Dropdown>
            <IconButton icon={isFull ? 'collapse' : 'expand'} onClick={() => setIsFull(!isFull)} title={isFull ? gettext('Collapse') : gettext('Expand')} />
            <IconButton icon="close" title={gettext('Close')} onClick={closeDocuments} />
          </div>
        </div>
        <div className="sea-ticket-chat-documents-body">
          <div className="sea-ticket-chat-document-info">
            <div className="sea-ticket-chat-document-info-content">
              <div className="sea-ticket-chat-document-info-size">{size}</div>
            </div>
            <div className="sea-ticket-chat-document-btns">
              <IconButton icon="copy" title={gettext('Copy')} onClick={handleCopyCurrentDocument} />
              <IconButton icon="download" title={gettext('Download')} onClick={handleDownloadCurrentDocument} />
            </div>
          </div>
          <div className="sea-ticket-chat-document-content">
            <CustomizeMarkdownViewer value={content} showTOC={false} className="sea-ticket-chat-document-md" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;
