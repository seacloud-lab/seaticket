import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { toaster } from 'dtable-ui-component';
import i18n from '../i18n-dtable';
import Loading from '../components/loading';
import WorkflowRowItem from './components/common/workflow-row-item';
import SelectOption from '../components-form/cell-formatter-widgets/select-option';
import { getValidWorkflowColumns } from './utils/utils';
import UserService from '../utils/user-service';

import '../css/dtable-share-form.css';
import '../css/dtable-edit-form.css';
import './css/dtable-workflow-common.css';
import './css/readonly-columns.css';
import './css/mobile/dtable-workflow-task-list-view.css';
import './components/mobile/add-workflow-task-view/index.css';

const { dtableMetadata, task, row, flowTable, showColumns, currentNode } = window.shared.pageOptions;
const {
  dtableName: fileName,
  workspaceID,
  dtableWebURL,
  token,
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
};
const gettext = window.gettext;


class DTableWorkflowSubmitted extends React.Component {

  constructor(props) {
    super(props);
    this.dtableMetadata = JSON.parse(dtableMetadata);
    this.task = JSON.parse(task);
    const dtableUuid = this.task.dtable_workflow.dtable_uuid;
    EDITOR_CONFIG.dtableUuid = dtableUuid;
    EDITOR_CONFIG.taskId = this.task.id;
    this.row = JSON.parse(row);
    this.flowTable = JSON.parse(flowTable);
    this.showColumns = JSON.parse(showColumns);
    this.currentNode = JSON.parse(currentNode);
    if (this.task && this.task.dtable_workflow && this.task.dtable_workflow.workflow_config) {
      this.workflowConfig = JSON.parse(this.task.dtable_workflow.workflow_config);
      const { columns_config, table_id } = this.workflowConfig;
      const tables = this.dtableMetadata.tables;
      this.workflowColumns = getValidWorkflowColumns(this.flowTable.columns, columns_config || {}, tables, table_id);
    }
    this.state = {
      collaborators: [],
    };
    this.userService = new UserService();
  }

  componentDidMount() {
    const { task_state } = this.task;
    if (task_state === 'finished') {
      const message = gettext('Task is finished.');
      toaster.success(message);
    }
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

  getColumns = () => {
    if (this.workflowColumns && Array.isArray(this.workflowColumns)) {
      return this.workflowColumns;
    }
    return this.flowTable && Array.isArray(this.flowTable.columns) ? this.flowTable.columns : [];
  };

  renderHeader = () => {
    const state_column_key = this.workflowConfig.state_column_key;
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
    const columns = this.getColumns();
    return (
      <div className="seatable-workflow-common seatable-workflow-submitted">
        <div className="workflow-app-main app-main">
          <div className='app-content'>
            <div className="seatable-share-form w-100">
              <div className='form-header'></div>
              <div className='form-content pb-8 mb-8'>
                {this.renderHeader()}
                {this.showColumns.map(showColumnItem => {
                  const column = columns.find(col => col.key === showColumnItem.key);
                  return (
                    <WorkflowRowItem
                      key={column.key}
                      column={column}
                      row={this.row}
                      table={this.flowTable}
                      tables={this.dtableMetadata.tables}
                      value={this.row[column.key]}
                      columns={columns}
                      isReadOnly={true}
                      isSupportPreview={true}
                      isShowDescriptionDirectly={false}
                      editorConfig={EDITOR_CONFIG}
                      workflowToken={this.task.dtable_workflow.token}
                      taskId={this.task.id}
                      canViewFile={true}
                      collaborators={this.state.collaborators}
                      queryUsers={this.queryUsers}
                    />
                  );
                })}
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
      <DTableWorkflowSubmitted />
    </Suspense>
  </I18nextProvider>
);
