import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { Button } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { toaster } from 'dtable-ui-component';
import i18n from '../i18n-dtable';
import Loading from '../components/loading';
import { dtableWebAPI } from '../api/dtable-web-api';
import WorkflowRowItem from './components/common/workflow-row-item';
import SelectOption from '../components-form/cell-formatter-widgets/select-option';
import MoreNodeSettingsDropdown from './components/dropdown/more-node-settings-dropdown';
import { isGeolocationCellEditable, Utils } from '../utils/utils';
import UserService from '../utils/user-service';
import {
  getValidWorkflowColumns,
  getWorkflowFormInitRowData,
  getDisplayNodeColumns,
  getWorkflowFilteredColumns,
  getMissedRequiredColumns,
  getNameValueRow,
  getLinkedRow
} from './utils/utils';
import { CellType } from 'dtable-utils';

import '../css/dtable-share-form.css';
import '../css/dtable-edit-form.css';
import './css/dtable-workflow-transfer.css';

const gettext = window.gettext;
const { dtableMetadata, task, row, readOnlyColumns, readWriteColumns, flowTable, validNodes,
  token, currentNode, theOtherNodes } = window.shared.pageOptions;

const {
  dtableName: fileName,
  workspaceID,
  dtableWebURL,
  type,
} = window.shared.pageOptions;
const { mediaUrl } = window.app.config;
const EDITOR_CONFIG = {
  dtableWebURL: dtableWebURL ? dtableWebURL.replace(/\/+$/, '') : '',
  workspaceID,
  fileName,
  mediaUrl,
  type,
  token,
  editorIn: 'workflow'
};

class DTableWorkflowTransfer extends React.Component {

  constructor(props) {
    super(props);
    this.dtableMetadata = JSON.parse(dtableMetadata);
    this.task = JSON.parse(task);
    const dtableUuid = this.task.dtable_workflow.dtable_uuid;
    EDITOR_CONFIG.dtableUuid = dtableUuid;
    EDITOR_CONFIG.taskId = this.task.id;
    this.flowTable = JSON.parse(flowTable);
    this.workflowConfig = JSON.parse(this.task.dtable_workflow.workflow_config);
    const { columns_config, table_id } = this.workflowConfig;
    const tables = this.dtableMetadata.tables;
    this.workflowColumns = getValidWorkflowColumns(this.flowTable.columns, columns_config || {}, tables, table_id);
    this.readOnlyColumns = getDisplayNodeColumns(this.workflowColumns, JSON.parse(readOnlyColumns));
    this.readWriteColumns = getDisplayNodeColumns(this.workflowColumns, JSON.parse(readWriteColumns));
    this.validNodes = JSON.parse(validNodes);
    this.currentNode = JSON.parse(currentNode);
    this.theOtherNodes = JSON.parse(theOtherNodes);
    this.validNodeOptions = this.validNodes.map(node => {
      return {
        label: node.name,
        value: node._id
      };
    });
    const rowData = JSON.parse(row); // { column_key: value }
    this.row = {};
    const displayReadWriteColumns = getWorkflowFilteredColumns(this.readWriteColumns, this.workflowColumns, this.row);
    const displayReadOnlyColumns = getWorkflowFilteredColumns(this.readOnlyColumns, this.workflowColumns, this.row);
    const defaultRowData = getWorkflowFormInitRowData(this.workflowColumns);
    Object.keys(rowData).forEach((key) => {
      const value = rowData[key];
      const defaultValue = defaultRowData[key];
      this.row[key] = !value && defaultValue ? defaultValue : value;
    });
    this.userService = new UserService();
    this.userService.getRelatedUsers(workspaceID, fileName, { workflowToken: token, taskId: this.task.id }, this.updateCollaborators);
    this.state = {
      updatedRow: {},
      updatedLinkedRow: {},
      isSubmitting: false,
      isMoreOpen: false,
      submitted: false,
      tabIndex: -1,
      displayReadOnlyColumns,
      displayReadWriteColumns,
      collaborators: [],
    };
    if (this.workflowConfig.workflow_name) {
      document.title = this.workflowConfig.workflow_name;
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (event) => {
    if (isHotkey('tab', event)) {
      let { tabIndex, isSubmitting, displayReadWriteColumns } = this.state;
      if (isSubmitting) return;
      event.stopPropagation();
      event.preventDefault();
      tabIndex++;
      if (tabIndex >= displayReadWriteColumns.length) {
        tabIndex = 0;
      }
      this.setState({ tabIndex });
    }
  };

  queryUsers = (emails) => {
    this.userService.queryUsers(emails, this.updateCollaborators);
  };

  updateCollaborators = (emailUserMap) => {
    let collaborators = [];
    for (let email in emailUserMap) {
      collaborators.push(emailUserMap[email]);
    }
    this.setState({ collaborators });
  };

  submitTransfer = (nextNodeId = null) => {
    this.setState({ isSubmitting: true });
    const { displayReadWriteColumns, updatedRow, updatedLinkedRow } = this.state;
    if (!nextNodeId || nextNodeId === this.currentNode.next_node_id) {
      const checkedRowData = { ...this.row, ...updatedRow, ...updatedLinkedRow };
      const missedRequiredColumns = getMissedRequiredColumns(displayReadWriteColumns, checkedRowData);
      const missedRequiredColumnsLength = missedRequiredColumns.length;
      if (missedRequiredColumnsLength > 0) {
        const message = missedRequiredColumnsLength > 1 ?
          gettext('Some required fields are missing')
          :
          gettext('A required field is missing');
        toaster.danger(message);
        this.setState({ isSubmitting: false });
        return;
      }
    }
    const nameValueRow = getNameValueRow(displayReadWriteColumns, updatedRow);
    const { existLinkedRows, newLinkedRows } = getLinkedRow(updatedLinkedRow);
    dtableWebAPI.transferWorkflowTask(token, this.task.id, nameValueRow, this.currentNode._id, nextNodeId, existLinkedRows, newLinkedRows).then(res => {
      toaster.success(gettext('Operation succeeded'));
      this.setState({ isSubmitting: false, submitted: true });
    }).catch(error => {
      this.setState({ isSubmitting: false });
      if (error.response && error.response.status === 409) {
        const errorMessage = gettext('Task has been handled');
        toaster.danger(errorMessage);
        return;
      }
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  };

  updateTabIndex = (tabIndex) => {
    this.setState({ tabIndex });
  };

  updateRowData = (updated) => { // update: { column_key: new_value }
    const { updatedRow, updatedLinkedRow } = this.state;
    const updateRowData = Object.assign({}, updatedRow, updated);
    const columnKey = Object.keys(updated)[0];
    const column = this.workflowColumns.find(column => column.key === columnKey);
    if (column && column.type === 'link') {
      const newLinkedRowData = { ...updatedLinkedRow, ...updated };
      this.setState({ updatedLinkedRow: newLinkedRowData });
      return;
    }
    const rowData = { ...this.row, ...updateRowData };
    const displayReadWriteColumns = getWorkflowFilteredColumns(this.readWriteColumns, this.workflowColumns, rowData);
    const displayReadOnlyColumns = getWorkflowFilteredColumns(this.readOnlyColumns, this.workflowColumns, rowData);
    const defaultRowData = getWorkflowFormInitRowData(this.workflowColumns);
    let newUpdatedRowData = {};
    Object.keys({ ...defaultRowData, ...updateRowData }).forEach((key) => {
      const value = rowData[key];
      const defaultValue = defaultRowData[key];
      newUpdatedRowData[key] = !value && defaultValue ? defaultValue : value;
    });
    this.setState({ updatedRow: newUpdatedRowData, displayReadWriteColumns, displayReadOnlyColumns });
  };

  renderHeader = () => {
    const { state_column_key } = this.workflowConfig;
    const column = this.flowTable.columns.find(column => column.key === state_column_key);
    const workflowName = this.workflowConfig.workflow_name;
    return (
      <h3 className='form-header-title workflow-title'>
        <span className="text-truncate" title={workflowName}>{workflowName}</span>
        {column && <SelectOption column={column} value={this.currentNode.state_option_id}/>}
      </h3>
    );
  };

  render() {
    const { isSubmitting, submitted, tabIndex, displayReadWriteColumns, displayReadOnlyColumns, updatedRow } = this.state;
    const row = { ...this.row, ...updatedRow };
    const allColumns = [...displayReadOnlyColumns, ...displayReadWriteColumns];

    return (
      <div className="seatable-workflow-common seatable-workflow-transfer">
        <div className="workflow-app-main app-main">
          <div className='app-content'>
            <div className="seatable-share-form w-100">
              <div className="form-header"></div>
              <div className="form-content pb-8 mb-8">
                {this.renderHeader()}
                {Array.isArray(displayReadOnlyColumns) && displayReadOnlyColumns.length > 0 &&
                  <div className="readonly-columns mt-0">
                    {displayReadOnlyColumns.map(column => {
                      return (
                        <WorkflowRowItem
                          key={column.key}
                          column={column}
                          row={row}
                          isFormMode={true}
                          table={this.flowTable}
                          tables={this.dtableMetadata.tables}
                          value={row[column.key]}
                          columns={allColumns}
                          onCommit={() => {}}
                          isReadOnly={true}
                          isSupportPreview={true}
                          editorConfig={EDITOR_CONFIG}
                          canViewFile={true}
                          collaborators={this.state.collaborators}
                          queryUsers={this.queryUsers}
                          workflowTaskId={this.task.id}
                        />
                      );
                    })}
                  </div>
                }
                {displayReadWriteColumns.map((column, index) => {
                  const { key, enable_fill_default_value, enable_not_change_default_value, default_value } = column;
                  const isDefaultReadOnly = enable_fill_default_value && enable_not_change_default_value && default_value === row[key];
                  let isCellEditable = true;
                  if (type === CellType.GEOLOCATION) {
                    isCellEditable = isGeolocationCellEditable(column);
                  }
                  const isReadOnly = !!this.readOnlyColumns.find(col => col.key === key) || isDefaultReadOnly || !isCellEditable;
                  return (
                    <WorkflowRowItem
                      key={key}
                      column={column}
                      row={row}
                      isFormMode={true}
                      table={this.flowTable}
                      tables={this.dtableMetadata.tables}
                      value={row[key]}
                      columns={allColumns}
                      onCommit={this.updateRowData}
                      isEditorShow={index === tabIndex}
                      updateTabIndex={() => this.updateTabIndex(index)}
                      isReadOnly={isReadOnly}
                      canViewFile={true}
                      editorConfig={EDITOR_CONFIG}
                      collaborators={this.state.collaborators}
                      queryUsers={this.queryUsers}
                      workflowTaskId={this.task.id}
                    />
                  );
                })}
                <div className="mt-4 flex-shrink-0 d-flex">
                  <Button
                    color="primary"
                    className="d-flex flex-shrink-0 align-items-center justify-content-center"
                    onClick={() => this.submitTransfer()}
                    disabled={isSubmitting || submitted}
                  >
                    {isSubmitting && <Loading />}
                    {gettext('Submit')}
                  </Button>
                  {!isSubmitting && !submitted && (
                    <MoreNodeSettingsDropdown
                      otherNodes={this.theOtherNodes}
                      onMoveTaskNode={this.submitTransfer}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DTableWorkflowTransfer />
    </Suspense>
  </I18nextProvider>
);
