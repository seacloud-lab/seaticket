import React, { useCallback, useState } from 'react';
import classnames from 'classnames';
import { Dropdown, DropdownToggle, Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { Icon, ModalPortal, toaster } from '../../../components';
import { BAR_TYPE_CONFIG, BAR_TYPE } from '../../constants';
import { NAVIGATION_BASE_PADDING } from '@/constants';
import { knowledgeBaseAPI } from '@/project/api';
import { CustomizeDropdownMenu, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '../../../components/';
import ImportDialog from '@/project/components/import-dialog';

const { projectUuid } = window.app.pageOptions;

const KnowledgeMoreNav = ({ onClick }) => {
  const [isShowChildren, setIsShowChildren] = useState(false);
  const [isShowImportDialog, setIsShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const toggleShowChildren = useCallback(() => {
    setIsShowChildren(!isShowChildren);
  }, [isShowChildren]);

  const handleTrashClick = useCallback(() => {
    onClick([BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE_TRASH].key]);
    setIsShowChildren(false);
  }, [onClick]);

  const handleImportClick = useCallback(() => {
    setIsShowImportDialog(true);

    // const input = document.createElement('input');
    // input.type = 'file';
    // input.accept = '.xlsx';
    // input.onchange = (e) => {
    //   const file = e.target.files[0];
    //   if (!file) return;
    //   knowledgeBaseAPI.importExcel(projectUuid, file, true).then(res => {
    //     const taskId = res?.data?.task_id;
    //     if (!taskId) return;
    //     const poll = () => {
    //       knowledgeBaseAPI.queryIOStatus(taskId).then(r => {
    //         if (r?.data?.is_finished) {
    //           setImportPreview(r?.data || {});
    //           setIsShowImportDialog(true);
    //         } else {
    //           setTimeout(poll, 1000);
    //         }
    //       }).catch(() => {});
    //     };
    //     poll();
    //   }).catch(() => {});
    // };
    // input.click();
    // setIsShowChildren(false);
    // onClick([BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE].key]);
  }, [onClick]);

  return (
    <>
      <Dropdown isOpen={isShowChildren} toggle={toggleShowChildren} className="sea-qa-side-panel-more-nav" direction="right">
        <DropdownToggle
          tag="div"
          className={classnames('sea-qa-project-navigation-item', { 'sea-qa-project-navigation-item-active': isShowChildren })}
          style={{ paddingLeft: NAVIGATION_BASE_PADDING }}
        >
          <Icon symbol={'more'} className="sea-qa-project-navigation-item-icon" />
          <span className="sea-qa-project-navigation-item-name">{window.gettext('More')}</span>
        </DropdownToggle>
        <CustomizeDropdownMenu
          className="position-fixed"
          modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]}
        >
          <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={handleImportClick}>
            <CustomizeDropdownItemIcon symbol={'import-xlsx'} className="sea-qa-dropdown-item-icon" />
            <CustomizeDropdownItemText>{window.gettext('Import records from XLSX')}</CustomizeDropdownItemText>
          </CustomizeDropdownItem>
          <CustomizeDropdownItem className="sea-qa-dropdown-item" onClick={handleTrashClick}>
            <CustomizeDropdownItemIcon symbol={'trash'} className="sea-qa-dropdown-item-icon" />
            <CustomizeDropdownItemText>{BAR_TYPE_CONFIG[BAR_TYPE.KNOWLEDGE_TRASH].name}</CustomizeDropdownItemText>
          </CustomizeDropdownItem>
        </CustomizeDropdownMenu>
      </Dropdown>

      {/* {isShowImportDialog && (
        <ModalPortal>
          <Modal isOpen={true} toggle={() => setIsShowImportDialog(false)}>
            <ModalBody>
              <div className="tip-default mb-2">{window.gettext('Total rows')}: {importPreview?.total_rows || 0}</div>
              <table className="table kb-import-preview-table">
                <thead>
                  <tr>
                    <th>{window.gettext('Title')}</th>
                    <th>{window.gettext('Content')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(importPreview?.preview_rows || []).map((row, index) => (
                    <tr key={index}>
                      <td><div className="kb-import-preview-title">{row?.title}</div></td>
                      <td><div className="kb-import-preview-content">{row?.content}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ModalBody>
            <ModalFooter>
              <Button color="secondary" onClick={() => setIsShowImportDialog(false)}>{window.gettext('Cancel')}</Button>
              <Button color="primary" onClick={() => {
                if (!importPreview) return;
                setIsImporting(true);
                knowledgeBaseAPI.commitImportExcel(projectUuid, importPreview.file_name).then(() => {
                  toaster.success(window.gettext('Updated successfully'));
                  setTimeout(() => window.location.reload(), 2000);
                }).catch(() => {
                  setIsImporting(false);
                });
              }} disabled={isImporting}>
                {window.gettext('Import')}
              </Button>
            </ModalFooter>
          </Modal>
        </ModalPortal>
      )} */}

      {isShowImportDialog && (
        <ImportDialog onToggle={() => { console.log(11), setIsShowImportDialog(false);}} />
      )}
    </>
  );
};

export default KnowledgeMoreNav;
