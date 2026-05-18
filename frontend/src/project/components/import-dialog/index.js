import React, { useCallback, useRef, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { getFileExtension } from '@/utils/download';
import { ModalHeader, Icon, toaster, CenteredLoading, Loading } from '@/components';
import { gettext } from '@/constants';
import { siteRoot } from '@/constants/config';
import { BAR_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import { KB_TABLE_NAME } from '@/project/main-panel/knowledge-base/constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const HOVER_BACKGROUND = 'rgba(237, 113, 9, 0.1)';
const DEFAULT_BACKGROUND = 'transparent';

const ImportDialog = ({ activeBar, onToggle, onClickBar }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFileSelected, setIsFileSelected] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [previewFileName, setPreviewFileName] = useState('');
  const uploadBoxRef = useRef(null);

  const { markTablesViewExpired } = useData();

  const onQueryIOStatus = useCallback((taskId) => {
    knowledgeBaseAPI.queryIOStatus(taskId).then(r => {
      if (r?.data?.is_finished) {
        if (r?.data?.preview_rows?.length === 0) {
          toaster.warning(gettext('Upload file is empty'));
        } else {
          setTotalRows(r?.data?.total_rows);
          setPreviewData(r?.data?.preview_rows);
          setPreviewFileName(r?.data?.file_name);
        }
        setIsLoading(false);
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
    setIsLoading(true);
    setIsFileSelected(true);
    knowledgeBaseAPI.importExcel(projectUuid, file, true).then(res => {
      const taskId = res?.data?.task_id;
      if (!taskId) return;
      onQueryIOStatus(taskId);
    }).catch(err => {
      setIsLoading(false);
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

  const handleSubmit = useCallback(() => {
    if (!previewFileName) {
      return toaster.warning(gettext('Empty files cannot be imported'));
    }
    setIsLoading(true);
    knowledgeBaseAPI.commitImportExcel(projectUuid, previewFileName).then(res => {
      setIsLoading(false);
      toaster.success(gettext('The records have been imported'));
      markTablesViewExpired([KB_TABLE_NAME], () => {
        if (activeBar[0] === BAR_TYPE.KNOWLEDGE) {
          const eventBus = context.eventBus;
          eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.RELOAD_DATA);
          return;
        }
        onClickBar([BAR_TYPE.KNOWLEDGE]);
      });
      onToggle();
    }).catch(err => {
      const errorMsg = Utils.getErrorMsg(err);
      toaster.danger(errorMsg);
      setIsLoading(false);
    });
  }, [activeBar, previewFileName, markTablesViewExpired]);

  return (
    <Modal isOpen={true} autoFocus={false} className="seaqa-import-dialog" toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Import records from a .xlsx file')}</ModalHeader>
      <ModalBody className="seaqa-import-content">
        <div className="seaqa-import-example-file">
          <div className="example-file-title">{gettext('Download the example file')}</div>
          <a className="btn btn-outline-primary" href={`${siteRoot}api/v1/knowledge-bases-import-example/`}>
            {gettext('Download')}
          </a>
        </div>
        <div className="seaqa-import-upload-file-wrapper">
          <div className="upload-file-title">{gettext('Upload file')}</div>
          {previewData.length !== 0 && (
            <div className="preview-file-box">
              <div className="preview-file-title">
                {totalRows <= 20 && (gettext('%s rows are about to be imported into this knowledge base.').replace('%s', totalRows))}
                {totalRows > 20 && (gettext('%s rows are about to be imported into this knowledge base, display the first 20 lines as a preview').replace('%s', totalRows))}
              </div>
              <table className="seaqa-preview-table">
                <thead>
                  <tr>
                    <th className="title-column-header text-truncate">
                      <span className="mr-2 header-column-icon"><Icon symbol="text"/></span>
                      <span>{gettext('Title')}</span>
                    </th>
                    <th className="content-column-header text-truncate">
                      <span className="mr-2 header-column-icon"><Icon symbol="long-text"/></span>
                      <span>{gettext('Content')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index}>
                      <td className="title-cell text-truncate">{row.title}</td>
                      <td className="content-cell text-truncate">{row.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previewData.length === 0 && (
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
                {isLoading ? <CenteredLoading /> : <Icon symbol="upload" />}
                <span className="upload-prompt-text">{isLoading ? gettext('Loading, please wait...') : gettext('Click or drag the .xlsx into the box to upload')}</span>
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" onClick={handleSubmit} disabled={!isFileSelected || isLoading}>{isLoading ? <Loading /> : gettext('Import')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default ImportDialog;
