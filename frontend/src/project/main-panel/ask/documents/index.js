import React, { useCallback, useMemo, useState } from 'react';
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
import { Selector } from '../components';

import './index.css';

const Documents = () => {
  const { isShowDocuments, documents, currentDocument, openDocument, closeDocuments, clear } = useDocuments();
  const [isFull, setIsFull] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);

  const documentsOptions = useMemo(() => {
    if (!Array.isArray(documents) || documents.length === 0) return [];
    return documents.map(document => {
      return {
        value: document.url,
        label: document.name,
        icon: 'ai-file',
      };
    });
  }, [documents]);

  const toggleMoreMenu = useCallback(() => {
    !setIsMoreMenuShow(!isMoreMenuShow);
  }, [isMoreMenuShow]);

  const handleToggleCurrentDocument = useCallback((documentURL) => {
    if (!documentURL) return;
    const document = documents.find(d => d.url === documentURL);
    openDocument(document);
  }, [openDocument, documents]);

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

  return (
    <div className={classnames('sea-ticket-chat-documents-wrapper', { 'full-content': isFull })}>
      <div className="sea-ticket-chat-documents">
        <div className="sea-ticket-chat-documents-header">
          <Selector
            value={currentDocument.url}
            options={documentsOptions}
            icon="arrow-down"
            className="sea-ticket-chat-documents-selector"
            iconPlacement="right"
            border={false}
            onChange={handleToggleCurrentDocument}
            isSearchEnabled={false}
            displayBgColor={true}
          >
            <IconButton icon="ai-file" size={14} className="no-hover-bg sea-ticket-chat-document-icon" />
            <div className="sea-ticket-chat-documents-count">{documents.length}</div>
            <div className="sea-ticket-chat-documents-divider"></div>
            <div className="sea-ticket-chat-document-name text-truncate" title={currentDocument.name}>{currentDocument.name}</div>
          </Selector>
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
            <IconButton icon="copy" title={gettext('Copy')} onClick={handleCopyCurrentDocument} />
            <IconButton icon="download" title={gettext('Download')} onClick={handleDownloadCurrentDocument} />
            <IconButton icon={isFull ? 'collapse' : 'view-issue'} onClick={() => setIsFull(!isFull)} title={isFull ? gettext('Collapse') : gettext('Expand')} />
            <IconButton icon="close" title={gettext('Close')} onClick={closeDocuments} />
          </div>
        </div>
        <div className="sea-ticket-chat-documents-body">
          <div className="sea-ticket-chat-document-content">
            <CustomizeMarkdownViewer key={currentDocument.url} value={content} showTOC={false} className="sea-ticket-chat-document-md" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;
