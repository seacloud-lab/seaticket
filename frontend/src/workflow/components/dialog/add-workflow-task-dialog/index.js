import React, { Component } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { CellType } from 'dtable-utils';
import { Button, Modal, ModalBody } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import { isGeolocationCellEditable, Utils } from '../../../../utils/utils';
import UserService from '../../../../utils/user-service';
import Loading from '../../../../components/loading';
import { WORKFLOW_ICONS, WORKFLOW_COLORS } from '../../../constants';
import WorkflowEndRemark from '../../common/workflow-end-remark';
import WorkflowRowItem from '../../common/workflow-row-item';
import {
  getValidWorkflowColumns,
  getDisplayNodeColumns,
  getWorkflowFilteredColumns,
  getMissedRequiredColumns,
  getNameValueRow,
  getLinkedRow,
  getWorkflowFormInitRowData
} from '../../../utils/utils';
import eventBus from '../../../../utils/event-bus';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';

import './index.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { server, name, userId } = window.app.pageOptions;
const VALID_SERVER = server ? server.replace(/\/+$/, '') : '';

class AddWorkflowTaskDialog extends Component {

  constructor(props) {
    super(props);
    const { workflow } = props;
    const { workflow_config } = workflow;
    this.workflowConfig = JSON.parse(workflow_config);
    this.tableId = '';
    this.workflowColumns = [];
    this.readwriteColumns = [];
    this.editorConfig = {};
    this.isSubmittedWorkflowTask = false;
    this.table = {};
    this.tables = [];
    this.userService = new UserService();
    this.state = {
      isLoading: true,
      isSubmitting: false,
      isShowEndRemark: false,
      rowData: {},
      linkedRowData: {},
      displayColumns: [],
      collaborators: [],
      tabIndex: -1,
      hasCommitedChanges: false,
      isShowConfirmCloseDialog: false,
    };
    this.isNeedPreventUpdateTab = false;
  }

  componentDidMount() {
    const { workflow } = this.props;
    const { token, dtable_uuid: dtableUuid } = workflow;
    dtableWebAPI.getWorkflowInitForm(token).then(res => {
      const { metadata, workspace_id, dtable_name, readwrite_columns, table_id,
        columns_config } = res.data;
      this.editorConfig = {
        mediaUrl,
        dtableWebURL: VALID_SERVER,
        workspaceID: workspace_id,
        fileName: dtable_name,
        token,
        dtableUuid,
        editorIn: 'workflow'
      };
      this.userService.getRelatedUsers(workspace_id, dtable_name, { workflowToken: token }, this.updateCollaborators);
      this.tableId = table_id;
      const readwriteColumns = readwrite_columns || [];
      const { tables } = metadata;
      this.tables = tables;
      const table = tables.find(table => table._id === this.tableId) || {};
      this.table = table;
      const { columns: tableColumns } = table;
      this.workflowColumns = getValidWorkflowColumns(tableColumns || [], columns_config, tables, table_id);
      this.readwriteColumns = getDisplayNodeColumns(this.workflowColumns, readwriteColumns);
      if (!document.getElementById('seafile-editor-font')) {
        const linkEle = document.createElement('link');
        linkEle.href = '/media/css/seafile-editor-font.css';
        linkEle.rel = 'stylesheet';
        linkEle.id = 'seafile-editor-font';
        document.head.appendChild(linkEle);
      }
      const displayColumns = getWorkflowFilteredColumns(this.readwriteColumns, this.workflowColumns);
      const rowData = getWorkflowFormInitRowData(displayColumns, { name, userId });
      this.setState({
        isLoading: false,
        displayColumns,
        rowData
      });
    }).catch(err => {
      if (!err.response || err.response.status !== 403) {
        const errorMessage = Utils.getErrorMsg(err);
        this.setState({ errorMessage, isLoading: false });
        return;
      }
      this.setState({ errorMessage: gettext('Error'), isLoading: false });
    });
    document.addEventListener('keydown', this.onKeyDown);
    this.unsubscribeUpdatePreventTab = eventBus.subscribe('update-prevent-tab', this.updatePreventTab);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
    this.unsubscribeUpdatePreventTab();
  }

  onKeyDown = (event) => {
    if (isHotkey('tab', event)) {
      let { tabIndex, displayColumns, isSubmitting } = this.state;
      if (isSubmitting || this.isNeedPreventUpdateTab) return;
      event.stopPropagation();
      event.preventDefault();
      tabIndex++;
      if (tabIndex >= displayColumns.length + 1) {
        tabIndex = 0;
      }
      this.setState({ tabIndex });
    } else if (isHotkey('enter', event)) {
      const { tabIndex, displayColumns, isSubmitting } = this.state;
      if (isSubmitting || tabIndex !== displayColumns.length) return;
      this.submitWorkflowForm();
    }
  };

  updatePreventTab = (isNeedPreventUpdateTab) => {
    this.isNeedPreventUpdateTab = isNeedPreventUpdateTab;
  };

  updateTabIndex = (tabIndex) => {
    this.setState({ tabIndex });
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

  submitWorkflowForm = () => {
    this.setState({ isSubmitting: true });
    const { workflow } = this.props;
    const { token } = workflow;
    const { displayColumns, rowData, linkedRowData } = this.state;
    const checkedData = { ...rowData, ...linkedRowData };
    const missedRequiredColumns = getMissedRequiredColumns(displayColumns, checkedData);
    const missedRequiredColumnsLength = missedRequiredColumns.length;
    if (missedRequiredColumnsLength > 0) {
      const message = missedRequiredColumnsLength > 1 ?
        gettext('Some required fields are missing')
        :
        gettext('A required field is missing');
      toaster.danger(message);
      let tabIndex = displayColumns.findIndex(column => column.key === missedRequiredColumns[0].key);
      this.setState({ isSubmitting: false, tabIndex });
      return;
    }
    const nameValueRow = JSON.stringify(getNameValueRow(displayColumns, rowData));
    const { existLinkedRows, newLinkedRows } = getLinkedRow(linkedRowData);
    dtableWebAPI.submitWorkflowTask(token, nameValueRow, this.tableId, '', '', existLinkedRows, newLinkedRows).then(res => {
      this.isSubmittedWorkflowTask = true;
      this.setState({ isShowEndRemark: true, isSubmitting: false, tabIndex: -1 });
      this.props.refreshPendingtasksCount();
    }).catch(err => {
      this.setState({ isSubmitting: false });
      this.handleError(err);
    });
  };

  handleError = (err) => {
    const errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  updateRowData = (update) => {
    const { rowData, linkedRowData } = this.state;
    const updateRowData = Object.assign({}, rowData, update);
    const columnKey = Object.keys(update)[0];
    const column = this.workflowColumns.find(column => column.key === columnKey);
    if (column && column.type === 'link') {
      const newLinkedRowData = { ...linkedRowData, ...update };
      this.setState({ linkedRowData: newLinkedRowData, hasCommitedChanges: true });
      return;
    }
    const displayColumns = getWorkflowFilteredColumns(this.readwriteColumns, this.workflowColumns, updateRowData);
    const initRowData = getWorkflowFormInitRowData(displayColumns);
    const newRowData = { ...initRowData, ...updateRowData };
    this.setState({ rowData: newRowData, displayColumns, hasCommitedChanges: true });
  };

  submitAgain = () => {
    const rowData = getWorkflowFormInitRowData(this.state.displayColumns);
    this.setState({ isShowEndRemark: false, rowData });
  };

  onToggle = () => {
    const { isShowEndRemark, hasCommitedChanges } = this.state;
    if (hasCommitedChanges && !isShowEndRemark) {
      this.setState({ isShowConfirmCloseDialog: true });
      return;
    }
    this.props.toggleAddWorkflowTaskDialog(this.isSubmittedWorkflowTask);
  };

  confirmCloseToggle = () => {
    this.setState({ isShowConfirmCloseDialog: !this.state.isShowConfirmCloseDialog });
  };

  renderModalBody = () => {
    const { isLoading, errorMessage, rowData, isSubmitting, isShowEndRemark,
      displayColumns, tabIndex } = this.state;
    if (isLoading) {
      return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center">
          <Loading />
        </div>
      );
    }
    if (errorMessage) {
      return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center">
          <div className="error-message">
            {errorMessage}
          </div>
        </div>
      );
    }
    if (isShowEndRemark) {
      return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center">
          <WorkflowEndRemark submitAgain={this.submitAgain}/>
        </div>
      );
    }
    const isSubmitFocus = tabIndex === displayColumns.length;
    return (
      <div className="add-workflow-task-columns-content">
        {displayColumns.map((column, index) => {
          const { key, type, enable_fill_default_value, enable_not_change_default_value } = column;
          let isCellEditable = true;
          if (type === CellType.GEOLOCATION) {
            isCellEditable = isGeolocationCellEditable(column);
          }
          const isReadOnly = (enable_fill_default_value && enable_not_change_default_value) || !isCellEditable;
          return (
            <WorkflowRowItem
              key={key}
              isReadOnly={isReadOnly}
              isShowDescriptionDirectly={false}
              column={column}
              columns={displayColumns}
              tables={this.tables}
              table={this.table}
              row={rowData}
              value={rowData[key]}
              editorConfig={this.editorConfig}
              onCommit={this.updateRowData}
              collaborators={this.state.collaborators}
              queryUsers={this.queryUsers}
              isEditorShow={index === tabIndex}
              updateTabIndex={() => this.updateTabIndex(index)}
            />
          );
        })}
        <Button
          className={`submit-workflow mb-4 mt-4 flex-shrink-0 d-flex justify-content-center align-items-center ${isSubmitFocus && 'focus'}`}
          onClick={this.submitWorkflowForm}
          color='primary'
          disabled={isSubmitting}
        >
          {isSubmitting && (<Loading />)}
          {gettext('Submit')}
        </Button>
      </div>
    );
  };

  render() {
    const { isShowConfirmCloseDialog } = this.state;
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0] } = this.workflowConfig;

    return (
      <Modal
        autoFocus={true}
        isOpen={true}
        size="lg"
        className="add-workflow-task-dialog"
        zIndex={100}
        toggle={this.onToggle}
      >
        <DTableModalHeader toggle={this.onToggle}>
          <span className="workflow-icon-content mr-2 align-items-center justify-content-center" style={{ backgroundColor: color }}>
            <i className={`dtable-icon-color-white workflow-icon-font base-font ${icon}`}></i>
          </span>
          {workflow_name}
        </DTableModalHeader>
        <ModalBody className="add-workflow-task-body">
          {this.renderModalBody()}
        </ModalBody>
        {isShowConfirmCloseDialog &&
          <CommonOperationConfirmationDialog
            title={`${gettext('Close task')}`}
            message={gettext('There are uncommitted changes, do you still want to close it?')}
            executeOperation={this.props.toggleAddWorkflowTaskDialog}
            toggleDialog={this.confirmCloseToggle}
          />
        }
      </Modal>
    );
  }
}

AddWorkflowTaskDialog.propTypes = {
  workflow: PropTypes.object.isRequired,
  toggleAddWorkflowTaskDialog: PropTypes.func.isRequired,
  refreshPendingtasksCount: PropTypes.func.isRequired
};

export default AddWorkflowTaskDialog;
