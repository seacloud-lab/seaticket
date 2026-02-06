import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, FormGroup, Label, Input, Alert } from 'reactstrap';
import classnames from 'classnames';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { ColorSelectorPopover, CustomizeSelect, IconButton, ModalHeader, Icon, toaster } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;
const ImportDialog = ({ onToggle }) => {
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

  const onHandleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      knowledgeBaseAPI.importExcel(projectUuid, file, true).then(res => {
        const taskId = res?.data?.task_id;
        if (!taskId) return;
        onQueryIOStatus(taskId);
      }).catch(err => {
        const errorMsg = Utils.getErrorMsg(err);
        toaster.danger(errorMsg);
      });
    };
    input.click();
  }, []);

  const onHandleDragUpload = useCallback((event) => {
    event.preventDefault();
    console.log(event.type);
    if (event.type === 'drop') {
      uploadBoxRef.current.style.backgroundColor = 'transparent';
      // for (let file of event.dataTransfer.files) {
      //   // 把文件保存到文件数组中
      //   fileArr.push(file)
      //   // 初始化文件
      //   filesToBlod(file)
      // }
    } else if (event.type === 'dragleave') {
      uploadBoxRef.current.style.backgroundColor = 'transparent';
    } else {
      uploadBoxRef.current.style.backgroundColor = 'rgba(237, 113, 9, 0.1)';
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
            onClick={onHandleUpload}
            onDrop={onHandleDragUpload}
            onDragEnter={onHandleDragUpload}
            onDragOver={onHandleDragUpload}
            onDragLeave={onHandleDragUpload}
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
