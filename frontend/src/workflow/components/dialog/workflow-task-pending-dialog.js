import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, Button, UncontrolledTooltip } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { toaster } from 'dtable-ui-component';
import isHotkey from 'is-hotkey';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import UserService from '../../../utils/user-service';
import WorkflowRowItem from '../common/workflow-row-item';
import Loading from '../../../components/loading';
import WorkflowChart from '../workflow-chart';
import { Utils, DIALOG_MAX_HEIGHT } from '../../../utils/utils';
import MoreNodeSettingsDropdown from '../dropdown/more-node-settings-dropdown';
import WorkflowTaskLogs from '../workflow-task-logs';
import {
  getValidWorkflowColumns,
  getWorkflowFormInitRowData,
  getDisplayNodeColumns,
  getWorkflowFilteredColumns,
  getMissedRequiredColumns,
  getNameValueRow,
  getLinkedRow
} from '../../utils/utils';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import WorkflowTaskHeaderRightBtn from './widgets/workflow-task-header-right-btn';

import '../../css/dialog/workflow-task-pending-dialog.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { server } = window.app.pageOptions;

class WorkflowTaskPendingDialog extends Component {

  constructor(props) {
    super(props);
    this.initConfig(props);
    this.state = {
      isMoreInfoShow: false,
      isLoading: true,
      isSubmitting: false,
      tabIndex: -1,
      updatedRow: {},
      updatedLinkedRow: {},
      moreInfoType: 'flow-chart',
      displayReadWriteColumns: [],
      displayReadOnlyColumns: [],
      collaborators: [],
      taskState: null,
      hasCommitedChanges: false,
      isShowConfirmCloseDialog: false,
    };
    this.modalRef = React.createRef();
    this.focusDom = React.createRef();
    this.animationEnd = false;
    this.userService = new UserService();
  }

  componentDidMount() {
    this.startAnimation();
    const { workflowTask } = this.props;
    const { dtable_workflow } = workflowTask;
    const dtableUuid = dtable_workflow.dtable_uuid;
    dtableWebAPI.getWorkflowTaskParticipantView(this.token, this.taskId).then(res => {
      const { table, tables, row, readonly_columns, readwrite_columns, nodes, current_node, workspace_id,
        dtable_name, the_other_nodes, columns_config, state: taskState } = res.data;
      this.table = table;
      this.tables = tables;
      this.nodes = nodes;
      this.row = {};
      this.currentNode = current_node;
      this.workspaceId = workspace_id;
      this.dtableName = dtable_name;
      this.theOtherNodes = the_other_nodes || [];
      this.editorConfig = {
        type: 'workflow',
        token: this.token,
        workspaceID: this.workspaceId,
        fileName: this.dtableName,
        dtableWebURL: server,
        mediaUrl,
        server,
        taskId: this.taskId,
        dtableUuid,
        editorIn: 'workflow'
      };
      this.userService.getRelatedUsers(this.workspaceId, this.dtableName, { workflowToken: this.token, taskId: this.taskId }, this.updateCollaborators);
      this.workflowColumns = getValidWorkflowColumns(this.table.columns, columns_config, tables, table._id);
      this.readOnlyColumns = getDisplayNodeColumns(this.workflowColumns, readonly_columns);
      this.readWriteColumns = getDisplayNodeColumns(this.workflowColumns, readwrite_columns);
      const displayReadOnlyColumns = getWorkflowFilteredColumns(this.readOnlyColumns, this.workflowColumns, row);
      const displayReadWriteColumns = getWorkflowFilteredColumns(this.readWriteColumns, this.workflowColumns, row);
      const defaultRowData = getWorkflowFormInitRowData(this.workflowColumns);
      Object.keys(row).forEach((key) => {
        const value = row[key];
        const defaultValue = defaultRowData[key];
        this.row[key] = !value && defaultValue ? defaultValue : value;
      });
      this.setState({ taskState: taskState });
      if (!document.getElementById('seafile-editor-font')) {
        const linkEle = document.createElement('link');
        linkEle.href = '/media/css/seafile-editor-font.css';
        linkEle.rel = 'stylesheet';
        linkEle.id = 'seafile-editor-font';
        document.head.appendChild(linkEle);
      }
      this.setState({
        isLoading: false,
        displayReadOnlyColumns,
        displayReadWriteColumns,
      });
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      this.setState({ isLoading: false });
    });
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  initConfig = (props) => {
    const { workflowTask } = props;
    const { dtable_workflow, id } = workflowTask;
    const { workflow_config, token } = dtable_workflow;
    this.workflowConfig = JSON.parse(workflow_config);
    const { workflow_name: workflowName } = this.workflowConfig;
    this.taskId = id;
    this.token = token;
    this.workflowName = workflowName;
    this.table = {};
    this.tables = [];
    this.row = {};
    this.readOnlyColumns = [];
    this.nodes = [];
    this.currentNode = {};
    this.workspaceId = null;
    this.dtableName = null;
    this.theOtherNodes = [];
    this.editorConfig = {};
  };

  queryUsers = (emails) => {
    this.userService.queryUsers(emails, this.updateCollaborators);
  };

  updateTabIndex = (tabIndex) => {
    this.setState({ tabIndex });
  };

  updateCollaborators = (emailUserMap) => {
    let collaborators = [];
    for (let email in emailUserMap) {
      collaborators.push(emailUserMap[email]);
    }
    this.setState({ collaborators });
  };

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

  onToggle = () => {
    if (this.state.hasCommitedChanges) {
      this.setState({ isShowConfirmCloseDialog: true });
      return;
    }
    this.props.onToggle();
  };

  toggleMoreInfoShow = () => {
    this.setState({ isMoreInfoShow: !this.state.isMoreInfoShow }, () => {
      localStorage.setItem('isWorkflowMoreInfoShow', this.state.isMoreInfoShow);
    });
  };

  getDialogStyle = () => {
    let { isMoreInfoShow } = this.state;
    let width = isMoreInfoShow ? 1100 : 800;
    return {
      width,
      maxWidth: width,
      marginLeft: (window.innerWidth - width) / 2,
      height: DIALOG_MAX_HEIGHT,
    };
  };

  getInitStyle = () => {
    const transition = 'all .3s';
    const defaultMargin = 80; // sequence cell width
    const defaultHeight = 100;
    const width = window.innerWidth;
    return {
      width: `${width - defaultMargin}px`,
      maxWidth: `${width - defaultMargin}px`,
      marginLeft: `${defaultMargin}px`,
      height: `${defaultHeight}px`,
      marginRight: `${defaultMargin}px`,
      marginTop: '30%',
      transition,
    };
  };

  startAnimation = () => {
    // use setTimeout to make sure real dom rendered
    const that = this;
    setTimeout(() => {
      let dom = this.modalRef.current.firstChild;
      const { width, maxWidth, marginLeft, height } = this.getDialogStyle();
      dom.style.width = `${width}px`;
      dom.style.maxWidth = `${maxWidth}px`;
      dom.style.marginLeft = `${marginLeft}px`;
      dom.style.height = `${height}px`;
      dom.style.marginRight = 'unset';
      dom.style.marginTop = '28px';
      // after animation, change style and run callback
      setTimeout(() => {
        that.animationEnd = true;
        dom.style.transition = 'none';
        const isMoreInfoShow = localStorage.getItem('isWorkflowMoreInfoShow');
        that.setState({ isMoreInfoShow: isMoreInfoShow === 'false' ? false : true });
      }, 280);
    }, 1);
  };

  updateRowData = (updated) => { // update: { column_key: new_value }
    const { updatedRow, updatedLinkedRow } = this.state;
    const updateRowData = Object.assign({}, updatedRow, updated);
    const columnKey = Object.keys(updated)[0];
    const column = this.workflowColumns.find(column => column.key === columnKey);
    if (column && column.type === 'link') {
      const newLinkedRowData = { ...updatedLinkedRow, ...updated };
      this.setState({ updatedLinkedRow: newLinkedRowData, hasCommitedChanges: true });
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
    this.setState({ updatedRow: newUpdatedRowData, displayReadWriteColumns, displayReadOnlyColumns, hasCommitedChanges: true });
  };

  onSubmit = (nextNodeId = null) => {
    this.setState({ isSubmitting: true });
    const { displayReadWriteColumns, updatedRow, updatedLinkedRow } = this.state;
    const row = { ...this.row, ...updatedRow };
    if (!nextNodeId || nextNodeId === this.currentNode.next_node_id) {
      const checkedData = { ...row, ...updatedLinkedRow };
      const missedRequiredColumns = getMissedRequiredColumns(displayReadWriteColumns, checkedData);
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
    dtableWebAPI.transferWorkflowTask(this.token, this.taskId, nameValueRow, this.currentNode._id, nextNodeId, existLinkedRows, newLinkedRows).then(res => {
      this.setState({ isSubmitting: false });
      toaster.success(gettext('Operation succeeded'));
      this.props.onReloadWorkflowTasks();
      this.props.onToggle();
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

  writeURLToClipboard = () => {
    const { workflowTask } = this.props;
    const { transfer_url } = workflowTask;
    copy(transfer_url);
    let message = gettext('Workflow task link copied');
    toaster.success(message);
  };

  renderWorkflowState = () => {
    const { workflowTask } = this.props;
    const { state } = workflowTask;
    const { taskState } = this.state;
    const stateType = Object.prototype.toString.call(state);
    let validState;
    if (!taskState) {
      validState = state;
      if (stateType === '[object String]') {
        const { state_column_key } = this.workflowConfig || {};
        const stateColumn = this.table.columns && this.table.columns.find(column => column.key === state_column_key);
        if (stateColumn) {
          const { data } = stateColumn;
          const options = (data && data.options) || [];
          const option = options.find(option => option.name === state);
          validState = option || { name: state, color: '#FFFCB5', textColor: '#212529' };
        } else {
          validState = { name: state, color: '#FFFCB5', textColor: '#212529' };
        }
      }
    } else {
      validState = taskState;
    }
    const { name, color, textColor } = validState || {};
    return (
      <span
        className="select-option workflow-task-state"
        style={{ color: textColor, backgroundColor: color }}
      >
        {name}
      </span>
    );
  };

  renderTaskDetails = () => {
    const { isLoading, isSubmitting, tabIndex, displayReadWriteColumns, displayReadOnlyColumns, updatedRow } = this.state;
    const { workflowTask } = this.props;
    const row = { ...this.row, ...updatedRow };
    if (isLoading) {
      return (
        <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
          <Loading />
        </div>
      );
    }
    const allColumns = [...displayReadOnlyColumns, ...displayReadWriteColumns];
    return (
      <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
        {Array.isArray(displayReadOnlyColumns) && displayReadOnlyColumns.length > 0 && (
          <div className="readonly-columns">
            {displayReadOnlyColumns.map(column => {
              return (
                <WorkflowRowItem
                  key={column.key}
                  column={column}
                  row={row}
                  value={row[column.key]}
                  columns={allColumns}
                  isReadOnly={true}
                  isSupportPreview={true}
                  isSubmitting={isSubmitting}
                  isShowDescriptionDirectly={false}
                  editorConfig={this.editorConfig}
                  onCommit={this.updateRowData}
                  canViewFile={true}
                  table={this.table}
                  tables={this.tables}
                  workflowTaskId={workflowTask.id}
                  collaborators={this.state.collaborators}
                  queryUsers={this.queryUsers}
                />
              );
            })}
          </div>
        )}
        {displayReadWriteColumns.map((column, index) => {
          const { key, enable_fill_default_value, enable_not_change_default_value, default_value } = column;
          const isDefaultReadOnly = enable_fill_default_value && enable_not_change_default_value && default_value === row[key];
          const isReadOnly = !!this.readOnlyColumns.find(col => col.key === key) || isDefaultReadOnly;
          return (
            <WorkflowRowItem
              key={key}
              column={column}
              row={row}
              value={row[key]}
              columns={allColumns}
              isReadOnly={isReadOnly}
              isSubmitting={isSubmitting}
              isShowDescriptionDirectly={false}
              editorConfig={this.editorConfig}
              onCommit={this.updateRowData}
              isEditorShow={index === tabIndex}
              updateTabIndex={() => this.updateTabIndex(index)}
              canViewFile={true}
              table={this.table}
              tables={this.tables}
              workflowTaskId={workflowTask.id}
              collaborators={this.state.collaborators}
              queryUsers={this.queryUsers}
            />
          );
        })}
        <div className="mb-4 mt-4 flex-shrink-0 d-flex">
          <Button
            color="primary"
            className="d-flex flex-shrink-0 align-items-center justify-content-center"
            onClick={() => this.onSubmit()}
            disabled={isSubmitting || !this.currentNode._id}
          >
            {isSubmitting && <Loading />}
            {gettext('Submit')}
          </Button>
          {this.currentNode.type !== 'init' &&
            <MoreNodeSettingsDropdown
              otherNodes={this.theOtherNodes}
              onMoveTaskNode={this.onSubmit}
            />
          }
        </div>
      </div>
    );
  };

  renderWorkflowNodes = () => {
    const { isLoading } = this.state;
    if (isLoading) {
      return (
        <div className="workflow-task-nodes-content" ref={ref => this.workflowNodesContentRef = ref}>
          <Loading />
        </div>
      );
    }

    return (
      <div className="workflow-task-nodes-content workflow-app-nodes-content" ref={ref => this.workflowNodesContentRef = ref}>
        <WorkflowChart
          readonly={true}
          selectedNode={this.currentNode}
          nodes={this.nodes}
          workflowRelatedUsers={[]}
        />
      </div>
    );
  };

  onChangeMoreInfoType = (moreInfoType) => {
    this.setState({ moreInfoType: moreInfoType });
  };

  confirmCloseToggle = () => {
    this.setState({ isShowConfirmCloseDialog: !this.state.isShowConfirmCloseDialog });
  };

  render() {
    const { isMoreInfoShow, moreInfoType, isShowConfirmCloseDialog } = this.state;
    const headerRightBtn = (
      <WorkflowTaskHeaderRightBtn
        isMoreInfoShow={isMoreInfoShow}
        onToggle={this.toggleMoreInfoShow}
        onClose={this.onToggle}
      />
    );
    return (
      <Modal
        isOpen={true}
        autoFocus={true}
        fade={false}
        style={this.animationEnd ? this.getDialogStyle() : this.getInitStyle()}
        zIndex={101}
        className="workflow-task-pending-dialog"
        contentClassName="workflow-task-pending-content"
        innerRef={this.modalRef}
        toggle={this.onToggle}
      >
        {this.animationEnd && (
          <div className="workflow-task-pending-details">
            <ModalHeader
              className="workflow-task-pending-details-header"
              close={isMoreInfoShow ? null : headerRightBtn}
            >
              <div className="workflow-task-title">
                <span className="workflow-task-title-content text-truncate">{this.workflowName}</span>
                {this.renderWorkflowState()}
                <span className="workflow-task-pending-details-header-url-btn">
                  <span
                    id='workflow-task-pending-url-btn'
                    onClick={this.writeURLToClipboard}
                    className='btn-icon btn-active workflow-task-url-btn'
                    data-placement="bottom"
                  >
                    <i className="dtable-font dtable-icon-url"></i>
                  </span>
                  <UncontrolledTooltip
                    target="workflow-task-pending-url-btn"
                    delay={{ show: 0, hide: 0 }}
                    placement='bottom'
                    fade={false}
                  >
                    {gettext('Get URL')}
                  </UncontrolledTooltip>
                </span>
              </div>
            </ModalHeader>
            <ModalBody className="workflow-task-container">
              {this.renderTaskDetails()}
            </ModalBody>
          </div>
        )}
        {(isMoreInfoShow && this.animationEnd) && (
          <div className="workflow-task-flow">
            <ModalHeader close={headerRightBtn} className="workflow-task-flow-header">
              <span
                onClick={this.onChangeMoreInfoType.bind(this, 'flow-chart')}
                className={`side-operation ${moreInfoType === 'flow-chart' ? 'flow-chart' : ''}`}
              >
                {gettext('Flow chart')}
              </span>
              <span
                onClick={this.onChangeMoreInfoType.bind(this, 'task-logs')}
                className={`side-operation ${moreInfoType === 'task-logs' ? 'task-logs' : ''}`}
              >
                {gettext('Task logs')}
              </span>
            </ModalHeader>
            <ModalBody className="workflow-task-flow-body">
              {moreInfoType === 'flow-chart' && this.renderWorkflowNodes()}
              {moreInfoType === 'task-logs' &&
                <WorkflowTaskLogs
                  workflowToken={this.token}
                  taskId={this.taskId}
                />
              }
            </ModalBody>
          </div>
        )}
        {isShowConfirmCloseDialog &&
          <CommonOperationConfirmationDialog
            title={`${gettext('Close task')}`}
            message={gettext('There are uncommitted changes, do you still want to close it?')}
            executeOperation={this.props.onToggle}
            toggleDialog={this.confirmCloseToggle}
          />
        }
      </Modal>
    );
  }
}

WorkflowTaskPendingDialog.propTypes = {
  workflowTask: PropTypes.object.isRequired,
  onReloadWorkflowTasks: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default WorkflowTaskPendingDialog;
