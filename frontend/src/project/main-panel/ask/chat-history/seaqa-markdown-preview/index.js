import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader, IconButton, toaster, CustomizeMarkdownViewer } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const PREVIEW_LINES = 5;

const SeaqaMarkdownPreview = ({ content, fileName }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const displayName = fileName || gettext('Markdown Document');

  const { previewContent, fullContent, hasMore } = useMemo(() => {
    if (!content) return { previewContent: '', fullContent: '', hasMore: false };

    const lines = content.split('\n');
    const previewLines = lines.slice(0, PREVIEW_LINES);
    const hasMore = lines.length > PREVIEW_LINES;

    return {
      previewContent: previewLines.join('\n'),
      fullContent: content,
      hasMore
    };
  }, [content]);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleCopy = useCallback(() => {
    copy(fullContent);
    toaster.success(gettext('The content has been copied'));
  }, [fullContent]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toaster.success(gettext('File downloaded'));
  }, [fullContent, fileName]);

  if (!content) return null;

  return (
    <>
      <div className="seaqa-markdown-preview" onClick={openDialog}>
        <div className="seaqa-markdown-preview-header">
          <span className="seaqa-markdown-preview-title">{displayName}</span>
        </div>
        <div className="seaqa-markdown-preview-content">
          <pre>{previewContent}{hasMore ? '...' : ''}</pre>
        </div>
      </div>

      {isDialogOpen && (
        <Modal
          isOpen={true}
          toggle={closeDialog}
          className="seaqa-markdown-dialog"
          modalClassName="seaqa-markdown-modal"
        >
          <ModalHeader toggle={closeDialog}>
            <div className="d-flex align-items-center">
              <span className="mr-2">{displayName}</span>
              <IconButton
                icon="copy"
                title={gettext('Copy')}
                onClick={handleCopy}
              />
              <IconButton
                icon="download"
                title={gettext('Download')}
                onClick={handleDownload}
              />
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="seaqa-markdown-dialog-content">
              <CustomizeMarkdownViewer value={fullContent} showTOC={false} />
            </div>
          </ModalBody>
        </Modal>
      )}
    </>
  );
};

SeaqaMarkdownPreview.propTypes = {
  content: PropTypes.string,
  fileName: PropTypes.string,
};

export default SeaqaMarkdownPreview;
