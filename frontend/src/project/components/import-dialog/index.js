import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input, Alert } from 'reactstrap';
import classnames from 'classnames';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { getFileExtension } from '@/utils/download';
import { ColorSelectorPopover, CustomizeSelect, IconButton, ModalHeader, Icon, toaster } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;
const HOVER_BACKGROUND = 'rgba(237, 113, 9, 0.1)';
const DEFAULT_BACKGROUND = 'transparent';
const ImportDialog = ({ onToggle, onClickBar }) => {
  const [previewData, setPreviewData] = useState(null);
  const uploadBoxRef = useRef(null);

  const handleSubmit = useCallback(() => {

  }, []);

  const onQueryIOStatus = useCallback((taskId) => {
    knowledgeBaseAPI.queryIOStatus(taskId).then(r => {
      if (r?.data?.is_finished) {
        console.log('previewData', r.data);
        setPreviewData(r?.data || {});
      } else {
        setTimeout(() => onQueryIOStatus(taskId), 1000);
      }
    }).catch(err => {
      const errorMsg = Utils.getErrorMsg(err);
      toaster.danger(errorMsg);
    });
  }, []);

  const onHandleFileUpload = useCallback((file) => {
    if (!file) return;
    knowledgeBaseAPI.importExcel(projectUuid, file, true).then(res => {
      const taskId = res?.data?.task_id;
      if (!taskId) return;
      onQueryIOStatus(taskId);
    }).catch(err => {
      const errorMsg = Utils.getErrorMsg(err);
      toaster.danger(errorMsg);
    });
  }, [onQueryIOStatus]);

  const onClickUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      onHandleFileUpload(file);
    };
    input.click();
  }, []);

  const onDragUpload = useCallback((event) => {
    event.preventDefault();
    if (event.type === 'drop') {
      uploadBoxRef.current.style.backgroundColor = DEFAULT_BACKGROUND;
      const file = event.dataTransfer.files[0];
      const extension = getFileExtension(file.name);
      if (!file || extension !== 'xlsx') return;
      onHandleFileUpload(file);
    } else if (event.type === 'dragleave') {
      uploadBoxRef.current.style.backgroundColor = DEFAULT_BACKGROUND;
    } else {
      uploadBoxRef.current.style.backgroundColor = HOVER_BACKGROUND;
    }
  }, []);

  return (
    <Modal isOpen={true} autoFocus={false} className="sea-qa-import-dialog" toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Import records from a .xlsx file')}</ModalHeader>
      <ModalBody className="sea-qa-import-content">
        <div className="sea-qa-import-example-file">
          <div className="example-file-title">{gettext('Download the example file')}</div>
          <button className="btn btn-outline-primary">{gettext('Download')}</button>
        </div>
        <div className="sea-qa-import-upload-file-wrapper">
          <div className="upload-file-title">{gettext('Download the example file')}</div>
          <div
            ref={uploadBoxRef}
            className="upload-file-box d-flex align-items-center justify-content-center"
            onClick={onClickUpload}
            onDrop={onDragUpload}
            onDragEnter={onDragUpload}
            onDragOver={onDragUpload}
            onDragLeave={onDragUpload}
          >
            <div className="upload-icon-wrapper d-flex flex-column align-items-center">
              <Icon symbol="upload" />
              <span className="drag-text">{gettext('Click or drag the xlsx into the box to upload')}</span>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit}>{gettext('Submit')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ImportDialog;
