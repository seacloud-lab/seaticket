import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import { Utils } from '../../../../utils/utils';
import Loading from '../../../../components/loading';
import UserService from '../../../../utils/user-service';
import { WORKFLOW_ICONS, WORKFLOW_COLORS } from '../../../constants';
import WorkflowEndRemark from '../../common/workflow-end-remark';
import WorkflowRowItem from '../../common/workflow-row-item';
import MobileCommonHeader from '../../../../pages/dtable/mobile/mobile-common-header';
import {
  getValidWorkflowColumns,
  getDisplayNodeColumns,
  getWorkflowFilteredColumns,
  getMissedRequiredColumns,
  getNameValueRow,
  getLinkedRow,
  getWorkflowFormInitRowData
} from '../../../utils/utils';

import './index.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;
const { server, name, userId } = window.app.pageOptions;
const VALID_SERVER = server ? server.replace(/\/+$/, '') : '';

class AddWorkflowTaskView extends Component {

  constructor(props) {
    super(props);
    const { workflow } = props;
    const { workflow_config } = workflow;
    this.workflowConfig = JSON.parse(workflow_config);
    this.tableId = '';
    this.workflowColumns = [];
    this.readwriteColumns = [];
    this.table = {};
    this.tables = [];
    this.editorConfig = {};
    this.isSubmittedWorkflowTask = false;
    this.userService = new UserService();
    this.state = {
      isLoading: true,
      isSubmitting: false,
      isShowEndRemark: false,
      rowData: {},
      linkedRowData: {},
      displayColumns: [],
      collaborators: [],
    };
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
        editorIn: 'workflow',
      };
      this.tableId = table_id;
      const readwriteColumns = readwrite_columns || [];
      const { tables } = metadata;
      this.tables = tables;
      const table = tables.find(table => table._id === this.tableId) || {};
      this.table = table;
      const { columns: tableColumns } = table;
      this.userService.getRelatedUsers(workspace_id, dtable_name, { workflowToken: token }, this.updateCollaborators);
      this.workflowColumns = getValidWorkflowColumns(tableColumns || [], columns_config, tables, table_id);
      this.readwriteColumns = getDisplayNodeColumns(this.workflowColumns, readwriteColumns);
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
  }

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
      this.setState({ isSubmitting: false });
      return;
    }
    const nameValueRow = JSON.stringify(getNameValueRow(displayColumns, rowData));
    const { existLinkedRows, newLinkedRows } = getLinkedRow(linkedRowData);
    dtableWebAPI.submitWorkflowTask(token, nameValueRow, this.tableId, '', '', existLinkedRows, newLinkedRows).then(res => {
      this.isSubmittedWorkflowTask = true;
      this.setState({ isShowEndRemark: true, isSubmitting: false });
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
      this.setState({ linkedRowData: newLinkedRowData });
      return;
    }
    const displayColumns = getWorkflowFilteredColumns(this.readwriteColumns, this.workflowColumns, updateRowData);
    const initRowData = getWorkflowFormInitRowData(displayColumns);
    const newRowData = { ...initRowData, ...updateRowData };
    this.setState({ rowData: newRowData, displayColumns });
  };

  submitAgain = () => {
    const rowData = getWorkflowFormInitRowData(this.state.displayColumns);
    this.setState({ isShowEndRemark: false, rowData });
  };

  onToggle = () => {
    this.props.toggleAddWorkflowTask(this.isSubmittedWorkflowTask);
  };

  renderForm = () => {
    const { isLoading, errorMessage, rowData, isSubmitting, isShowEndRemark, displayColumns } = this.state;
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
    return (
      <div className="add-workflow-task-columns-content">
        {displayColumns.map(column => {
          const { key, enable_fill_default_value, enable_not_change_default_value } = column;
          const isReadOnly = enable_fill_default_value && enable_not_change_default_value;
          return (
            <WorkflowRowItem
              key={key}
              canViewFile={true}
              isReadOnly={isReadOnly}
              column={column}
              columns={displayColumns}
              row={rowData}
              tables={this.tables}
              table={this.table}
              value={rowData[key]}
              editorConfig={this.editorConfig}
              onCommit={this.updateRowData}
              collaborators={this.state.collaborators}
              queryUsers={this.queryUsers}
            />
          );
        })}
        <Button
          className="submit-workflow mb-4 mt-4 flex-shrink-0 d-flex justify-content-center align-items-center"
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
    const { workflow_name, icon = WORKFLOW_ICONS[0], color = WORKFLOW_COLORS[0] } = this.workflowConfig;

    return (
      <div className="add-workflow-task-view workflow-list-view">
        <MobileCommonHeader
          leftName={(<i className="dtable-font dtable-icon-return"></i>)}
          onLeftClick={this.onToggle}
          title={(
            <>
              <span className="workflow-icon-content mr-2 align-items-center justify-content-center" style={{ backgroundColor: color }}>
                <i className={`dtable-icon-color-white workflow-icon-font base-font ${icon}`}></i>
              </span>
              {workflow_name}
            </>
          )}
        />
        <div className="add-workflow-task-view-container">
          {this.renderForm()}
        </div>
      </div>
    );
  }
}

AddWorkflowTaskView.propTypes = {
  workflow: PropTypes.object.isRequired,
  toggleAddWorkflowTask: PropTypes.func.isRequired,
};

export default AddWorkflowTaskView;
