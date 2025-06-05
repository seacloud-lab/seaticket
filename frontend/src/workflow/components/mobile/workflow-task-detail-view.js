import React, { Component } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import ModalPortal from '../../../components/modal-portal';
import { isGeolocationCellEditable, Utils } from '../../../utils/utils';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import UserService from '../../../utils/user-service';
import Loading from '../../../components/loading';
import WorkflowTaskLogs from '../workflow-task-logs';
import WorkflowChart from '../workflow-chart';
import WorkflowRowItem from '../../../workflow/components/common/workflow-row-item';
import MoreNodeSettingsView from './more-node-settings-view';
import {
  getValidWorkflowColumns,
  getWorkflowFormInitRowData,
  getDisplayNodeColumns,
  getWorkflowFilteredColumns,
  getMissedRequiredColumns,
  getNameValueRow,
  getLinkedRow
} from '../../utils/utils';
import { TASK_TYPE } from '../../constants';
import { CellType } from 'dtable-utils';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { server } = window.app.pageOptions;

const DETAIL_TYPE_FORM = 'form';
const DETAIL_TYPE_CHART = 'flow-chart';
const DETAIL_TYPE_LOGS = 'task-logs';

class WorkflowTaskDetailView extends Component {

  constructor(props) {
    super(props);
    this.initConfig(props);
    this.state = {
      isLoading: true,
      isSubmitting: false,
      isMoreNodeSettingsViewShow: false,
      updatedRow: {},
      updatedLinkedRow: {},
      currentType: DETAIL_TYPE_FORM,
      displayReadWriteColumns: [],
      displayReadOnlyColumns: [],
      collaborators: [],
    };
    this.userService = new UserService();
  }

  componentDidMount() {
    const { isSpecificWorkflow, currentTag, workflowTask } = this.props;
    const { dtable_workflow } = workflowTask;
    const dtableUuid = dtable_workflow.dtable_uuid;
    let apiName;
    if (currentTag === TASK_TYPE.INITIATED) {
      apiName = 'getWorkflowTaskInitiatorView';
    } else {
      apiName = 'getWorkflowTaskAdminView';
    }
    if (isSpecificWorkflow) {
      dtableWebAPI[apiName](this.token, this.taskId).then(res => {
        const { table, tables, row, show_columns, nodes, current_node, workspace_id,
          dtable_name, columns_config } = res.data;
        this.table = table;
        this.tables = tables;
        this.row = row;
        this.nodes = nodes;
        this.currentNode = current_node;
        this.workspaceId = workspace_id;
        this.dtableName = dtable_name;
        this.editorConfig = {
          type: 'workflow',
          token: this.token,
          taskId: this.taskId,
          workspaceID: workspace_id,
          fileName: dtable_name,
          dtableWebURL: server,
          mediaUrl,
          server,
          dtableUuid,
          editorIn: 'workflow'
        };
        this.userService.getRelatedUsers(this.workspaceId, this.dtableName, { workflowToken: this.token, taskId: this.taskId }, this.updateCollaborators);
        this.workflowColumns = getValidWorkflowColumns(this.table.columns, columns_config, tables, table._id);
        const shownColumns = getDisplayNodeColumns(this.workflowColumns, show_columns);
        this.displayColumns = getWorkflowFilteredColumns(shownColumns, this.workflowColumns, row);
        this.setState({
          isLoading: false,
        });
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        this.setState({ isLoading: false });
      });
    } else {
      dtableWebAPI.getWorkflowTaskParticipantView(this.token, this.taskId).then(res => {
        const { nodes, current_node, row, readonly_columns, the_other_nodes,
          readwrite_columns, table, tables, workspace_id, dtable_name, columns_config } = res.data;
        this.table = table;
        this.tables = tables;
        this.row = {};
        this.nodes = nodes;
        this.currentNode = current_node;
        this.theOtherNodes = the_other_nodes || [];
        this.editorConfig = {
          type: 'workflow',
          token: this.token,
          workspaceID: workspace_id,
          fileName: dtable_name,
          dtableWebURL: server,
          mediaUrl,
          server,
          taskId: this.taskId,
          dtableUuid,
          editorIn: 'workflow'
        };
        this.workflowColumns = getValidWorkflowColumns(this.table.columns, columns_config, tables, table._id);
        this.readOnlyColumns = getDisplayNodeColumns(this.workflowColumns, readonly_columns);
        this.readWriteColumns = getDisplayNodeColumns(this.workflowColumns, readwrite_columns);
        const displayReadWriteColumns = getWorkflowFilteredColumns(this.readWriteColumns, this.workflowColumns, row);
        const displayReadOnlyColumns = getWorkflowFilteredColumns(this.readOnlyColumns, this.workflowColumns, row);
        const defaultRowData = getWorkflowFormInitRowData(this.workflowColumns);
        Object.keys(row).forEach((key) => {
          const value = row[key];
          const defaultValue = defaultRowData[key];
          this.row[key] = !value && defaultValue ? defaultValue : value;
        });
        this.setState({
          isLoading: false,
          displayReadWriteColumns,
          displayReadOnlyColumns,
        });
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        this.setState({ isLoading: false });
      });
    }
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
    this.nodes = [];
    this.currentNode = {};
    this.table = {};
    this.tables = [];
    this.editorConfig = {};
    this.readOnlyColumns = [];
    this.displayColumns = [];
    this.theOtherNodes = [];
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

  writeURLToClipboard = () => {
    const { workflowTask } = this.props;
    const { transfer_url } = workflowTask;
    copy(transfer_url);
    let message = gettext('Workflow task link copied');
    toaster.success(message);
  };

  onClickDetailView = (e) => {
    if (e.target.className.indexOf('dtable-icon-return') > -1) return;
    e.stopPropagation();
  };

  switchType = (type) => {
    const { currentType } = this.state;
    if (currentType === type) return;
    this.setState({ currentType: type });
  };

  toggleNodeSettingView = (e) => {
    if (!e) return;
    this.setState({
      isMoreNodeSettingsViewShow: !this.state.isMoreNodeSettingsViewShow
    });
  };

  updateRow = (updated) => { // update: { column_key: new_value }
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
    const defaultRowData = getWorkflowFormInitRowData(displayReadWriteColumns);
    let newUpdatedRowData = {};
    Object.keys({ ...defaultRowData, ...updateRowData }).forEach((key) => {
      const value = rowData[key];
      const defaultValue = defaultRowData[key];
      newUpdatedRowData[key] = !value && defaultValue ? defaultValue : value;
    });
    this.setState({ updatedRow: newUpdatedRowData, displayReadWriteColumns, displayReadOnlyColumns });
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
      toaster.success(gettext('Operate successfully'));
      this.props.reloadFirstPageWorkflowTasks();
      this.props.toggle();
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

  renderHeader = () => {
    const { workflowTask } = this.props;
    const { state, is_valid, dtable_workflow } = workflowTask;
    const workflow_config = JSON.parse(dtable_workflow.workflow_config);
    return (
      <div className="view-header">
        <div className="detail-view-header-left">
          <span className="view-header-back-btn" onClick={this.props.toggle}>
            <i className="dtable-font dtable-icon-return"></i>
          </span>
          <span className="ml-2 text-truncate detail-view-header-left-name">{workflow_config.workflow_name}</span>
          {is_valid && state && (
            <span
              className="header-current-node ml-1"
              style={{ color: state.textColor, backgroundColor: state.color }}
            >
              {state.name}
            </span>
          )}
        </div>
        <div className="view-header-right view-detail-right">
          <span className="mr-4" onClick={this.writeURLToClipboard}>
            <i className="dtable-font dtable-icon-url"></i>
          </span>
        </div>
      </div>
    );
  };

  renderWorkflowTodoTaskForms = () => {
    const { isLoading, isSubmitting, displayReadWriteColumns, displayReadOnlyColumns, updatedRow } = this.state;
    const row = { ...this.row, ...updatedRow };
    const { workflowTask } = this.props;
    if (isLoading) {
      return (
        <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
          <Loading />
        </div>
      );
    }
    const allColumns = [...displayReadOnlyColumns, ...displayReadWriteColumns];
    return (
      <div className="workflow-task-view-form" ref={ref => this.contentRef = ref}>
        {Array.isArray(displayReadOnlyColumns) && displayReadOnlyColumns.length > 0 && (
          <div className="readonly-columns">
            {displayReadOnlyColumns.map(column => {
              return (
                <WorkflowRowItem
                  key={column.key}
                  canViewFile={true}
                  column={column}
                  table={this.table}
                  tables={this.tables}
                  row={row}
                  value={row[column.key]}
                  columns={allColumns}
                  isReadOnly={true}
                  isSupportPreview={true}
                  isSubmitting={isSubmitting}
                  editorConfig={this.editorConfig}
                  onCommit={() => {}}
                  collaborators={this.state.collaborators}
                  queryUsers={this.queryUsers}
                />
              );
            })}
          </div>
        )}
        {displayReadWriteColumns.map(column => {
          const { key, type, enable_fill_default_value, enable_not_change_default_value, default_value } = column;
          const isDefaultReadOnly = enable_fill_default_value && enable_not_change_default_value && default_value === row[key];
          let isCellEditable = true;
          if (type === CellType.GEOLOCATION) {
            isCellEditable = isGeolocationCellEditable(column);
          }
          const isReadOnly = !!this.readOnlyColumns.find(col => col.key === key) || isDefaultReadOnly || !isCellEditable;
          return (
            <WorkflowRowItem
              key={key}
              canViewFile={true}
              column={column}
              table={this.table}
              tables={this.tables}
              row={row}
              value={row[key]}
              columns={allColumns}
              isReadOnly={isReadOnly}
              isSubmitting={isSubmitting}
              editorConfig={this.editorConfig}
              onCommit={this.updateRow}
              workflowTaskId={workflowTask.id}
              collaborators={this.state.collaborators}
              queryUsers={this.queryUsers}
            />
          );
        })}
        <div className="mb-4 mt-4 flex-shrink-0">
          <Button
            color="primary"
            className="d-flex flex-shrink-0 align-items-center w-100 justify-content-center"
            onClick={() => this.onSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loading />}
            {!isSubmitting && gettext('Submit')}
          </Button>
          <Button
            color="outline-primary"
            className="d-flex flex-shrink-0 align-items-center w-100 mt-2 justify-content-center"
            onClick={this.toggleNodeSettingView}
            disabled={isSubmitting}
          >
            {gettext('Move to node...')}
          </Button>
        </div>
      </div>
    );
  };

  renderWorkflowSpecificTaskForms = () => {
    const { isLoading } = this.state;
    if (isLoading) {
      return (
        <div className="workflow-task-pending-content" ref={ref => this.contentRef = ref}>
          <Loading />
        </div>
      );
    }
    return (
      <div className="workflow-task-view-form" ref={ref => this.contentRef = ref}>
        {this.displayColumns.map(column => {
          if (!column.key) return null;
          return (
            <WorkflowRowItem
              key={column.key}
              canViewFile={true}
              column={column}
              table={this.table}
              tables={this.tables}
              row={this.row}
              value={this.row[column.key]}
              columns={this.workflowColumns}
              isReadOnly={true}
              isSupportPreview={true}
              editorConfig={this.editorConfig}
              onCommit={() => {}}
              collaborators={this.state.collaborators}
              queryUsers={this.queryUsers}
            />
          );
        })}
      </div>
    );
  };

  renderWorkflowNodes = () => {
    const { isLoading } = this.state;
    if (isLoading) {
      return (
        <div className="workflow-task-nodes-content">
          <Loading />
        </div>
      );
    }

    return (
      <div className="workflow-task-nodes-content workflow-app-nodes-content">
        <WorkflowChart
          readonly={true}
          selectedNode={this.currentNode}
          nodes={this.nodes}
          workflowRelatedUsers={[]}
        />
      </div>
    );
  };

  renderContainer = () => {
    const { isSpecificWorkflow } = this.props;
    const { currentType } = this.state;
    switch (currentType) {
      case DETAIL_TYPE_LOGS: {
        return (
          <WorkflowTaskLogs
            workflowToken={this.token}
            taskId={this.taskId}
          />
        );
      }
      case DETAIL_TYPE_CHART: {
        return this.renderWorkflowNodes();
      }
      default: {
        if (isSpecificWorkflow) {
          return this.renderWorkflowSpecificTaskForms();
        } else {
          return this.renderWorkflowTodoTaskForms();
        }
      }
    }
  };

  render() {
    const { currentType, isMoreNodeSettingsViewShow } = this.state;
    return (
      <div className="workflow-list-view" onClick={this.onClickDetailView}>
        {this.renderHeader()}
        <div className="specific-list-view-sidebar">
          <ul>
            <li
              className={`${currentType === DETAIL_TYPE_FORM ? 'sidebar-item-active' : ''}`}
              onClick={this.switchType.bind(this, DETAIL_TYPE_FORM)}
            >
              <span>{gettext('Form')}</span>
            </li>
            <li
              className={`${currentType === DETAIL_TYPE_CHART ? 'sidebar-item-active' : ''}`}
              onClick={this.switchType.bind(this, DETAIL_TYPE_CHART)}
            >
              <span>{gettext('Flow chart')}</span>
            </li>
            <li
              className={`${currentType === DETAIL_TYPE_LOGS ? 'sidebar-item-active' : ''}`}
              onClick={this.switchType.bind(this, DETAIL_TYPE_LOGS)}
            >
              <span>{gettext('Task logs')}</span>
            </li>
          </ul>
        </div>
        {this.renderContainer()}
        {isMoreNodeSettingsViewShow &&
          <ModalPortal>
            <MoreNodeSettingsView
              otherNodes={this.theOtherNodes || []}
              onMoveTaskNode={this.onSubmit}
              toggleNodeSettingView={this.toggleNodeSettingView}
            />
          </ModalPortal>
        }
      </div>
    );
  }
}

WorkflowTaskDetailView.propTypes = {
  isSpecificWorkflow: PropTypes.bool,
  workflowTask: PropTypes.object,
  currentTag: PropTypes.string,
  toggle: PropTypes.func,
  reloadFirstPageWorkflowTasks: PropTypes.func,
};

export default WorkflowTaskDetailView;
