import React, { Fragment, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import isHotkey from 'is-hotkey';
import { I18nextProvider } from 'react-i18next';
import { CellType } from 'dtable-utils';
import { toaster } from 'dtable-ui-component';
import i18n from '../i18n-dtable';
import { dtableWebAPI } from '../api/dtable-web-api';
import context from './utils/context.js';
import Loading from '../components/loading';
import DTableUtils from './utils/dtable-utils.js';
import { Utils } from '../utils/utils';
import WorkflowContent from './components/workflow-content.js';
import NewWorkflowSettingsDialog from './components/dialog/new-workflow-settings-dialog';
import AdditionalParticipantsDialog from './components/dialog/additional-participants-dialog';
import { NODE_PARTICIPANTS_TYPE, NODE_TYPE } from './constants';
import { getValidWorkflowColumns, getShowColumns } from './utils/utils';

import '../css/dtable-share-form.css';
import '../css/dtable-edit-form.css';
import './css/dtable-workflow-common.css';
import './css/dtable-workflow.css';

window.dtableWebAPI = dtableWebAPI;

const gettext = window.gettext;
const {
  dtableName: fileName,
  workspaceID,
  dtableWebURL,
  token,
  dtableUuid,
} = window.shared.pageOptions;
const { mediaUrl, lang } = window.app.config;
const EDITOR_CONFIG = {
  dtableWebURL: dtableWebURL ? dtableWebURL.replace(/\/+$/, '') : '',
  workspaceID,
  fileName,
  mediaUrl,
  token,
  dtableUuid,
};

class DTableWorkflowEdit extends React.Component {

  constructor(props) {
    super(props);
    const workflowConfig = context.getSetting('workflowConfig');
    this.state = {
      isLoading: true,
      workflowConfig: JSON.parse(workflowConfig),
      isSaving: false,
      tables: [],
      errorMessage: '',
      isFirstLoad: false,
      isParticipantsColumnShow: false,
      hasUnsavedChanges: false,
      workflowRelatedUsers: [],
      wechatAccounts: [],
      dingtalkAccounts: [],
    };
    this.dtableUtils = new DTableUtils(context.getConfig());
  }

  componentDidMount() {
    this.initWorkflowDTableData();
    document.addEventListener('keydown', this.onDocumentKeydown);
    window.addEventListener('beforeunload', this.beforeunloadHandler, false);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
    window.removeEventListener('beforeunload', this.beforeunloadHandler, false);
  }

  beforeunloadHandler = (e) => {
    if (this.state.hasUnsavedChanges) {
      e.preventDefault();
      return e.returnValue = gettext('Workflow not saved!');
    }
  };

  onDocumentKeydown = (e) => {
    const isModS = isHotkey('mod+s');
    if (isModS(e)) {
      e.preventDefault();
      this.onSave();
    }
  };

  async initWorkflowDTableData() {
    try {
      const { workflowConfig } = this.state;
      await this.dtableUtils.init(workflowConfig);
      let workflowRelatedUsers = this.dtableUtils.relatedUsers || [];
      const allParticipants = [];
      const workflowNodes = workflowConfig.nodes;
      Array.isArray(workflowNodes) && workflowNodes.forEach(node => {
        const { participants = [] } = node;
        const unKnowParticipants = participants.filter(email => !workflowRelatedUsers.find(user => user.email === email));
        allParticipants.push(...unKnowParticipants);
      });
      if (allParticipants.length > 0) {
        const usersRes = await dtableWebAPI.listUserInfo(allParticipants);
        const userList = usersRes.data.user_list;
        workflowRelatedUsers.push(...userList);
      }
      this.setState({ workflowRelatedUsers });
      if (lang === 'zh-cn') {
        const res = await dtableWebAPI.listThirdPartyAccounts(dtableUuid);
        let accounts = res.data.accounts_list;
        let wechatAccounts = accounts.filter(account => {
          return account.account_type === 'wechat_robot';
        });
        let dingtalkAccounts = accounts.filter(account => {
          return account.account_type === 'dingtalk_robot';
        });
        this.setState({ wechatAccounts: wechatAccounts, dingtalkAccounts: dingtalkAccounts });
      }
      let isFirstLoad = false;
      if (!workflowConfig.table_id || !workflowConfig.state_column_key) {
        isFirstLoad = true;
      }
      let isParticipantsColumnShow = !isFirstLoad && !workflowConfig.participants_column_key;
      const newWorkflowConfig = this.dtableUtils.getConfig(workflowConfig);
      const tables = this.dtableUtils.getTables();
      this.setState({
        tables,
        isLoading: false,
        workflowConfig: newWorkflowConfig,
        isFirstLoad,
        isParticipantsColumnShow,
      });
    } catch (err) {
      let errorMessage = gettext('Network error');
      if (err.response) {
        const { status } = err.response;
        if (status === 403) {
          errorMessage = gettext('The token has expired, please refresh the page.');
        }
        if (status === 500) {
          errorMessage = gettext('Internal Server Error.');
        }
        if (status === 404) {
          errorMessage = gettext('The sharing link has expired');
        }
      }
      this.setState({
        isLoading: false,
        errorMessage: errorMessage
      });
    }
  }

  updateWorkflowRelatedUsers = (users) => {
    this.setState({ workflowRelatedUsers: users });
  };

  validateConfig = (config) => {
    let errInfo = null;
    let isValid = false;
    if (!config) {
      return { isValid };
    }
    const { workflow_name, table_id, state_column_key, nodes } = config;
    if (!workflow_name || !table_id) {
      return { isValid };
    }
    if (nodes && nodes.length > 0 && !state_column_key) {
      errInfo = gettext('State column is required');
      return { isValid, errInfo };
    }
    // Check nodes
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      const { type } = node;
      if (['init', 'normal', 'completed'].indexOf(type) === -1) {
        errInfo = gettext('Node type invalid');
        return { isValid, errInfo };
      }
    }
    return { isValid: true, errInfo: null };
  };

  onSave = () => {
    const { workflowConfig, hasUnsavedChanges } = this.state;
    const hasUnConfigLinkColumn = this.checkUnConfigLinkColumn();
    if (!hasUnsavedChanges || hasUnConfigLinkColumn) return;

    /** In order to avoid user confusion, cancel validateConfig */
    // let { isValid, errInfo } = this.validateConfig(newAppConfig);
    // // If invalid, do not save it to the server
    // if (!isValid) {
    //   if (errInfo) {
    //     toaster.danger(errInfo);
    //   }
    //   return;
    // }

    const { nodes } = workflowConfig;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.participants_type === NODE_PARTICIPANTS_TYPE.DYNAMIC && !node.node_participants_column_key) {
        toaster.danger(gettext('Node {node} has not been set assignee column').replace('{node}', node.name));
        return;
      }
      if (node.type === NODE_TYPE.NORMAL && node.enable_processing_time_limit) {
        if (!node.processing_time_limit.trim()) {
          toaster.danger(gettext('Node {node} has not been set processing time limit').replace('{node}', node.name));
          return;
        }
        if (!/^\+\d+[dh]$/.test(node.processing_time_limit)) {
          toaster.danger(gettext('Node {node} processing time limit invalid').replace('{node}', node.name));
          return;
        }
        if (!parseInt(node.processing_time_limit.slice(1, -1))) {
          toaster.danger(gettext('Node {node} processing time limit invalid').replace('{node}', node.name));
          return;
        }
      }
    }

    this.setState({ isSaving: true });
    context.updateWorkflow(workflowConfig).then(res => {
      const workflow = res.data.workflow;
      const tables = this.dtableUtils.getTables();
      this.setState({
        workflowConfig: JSON.parse(workflow.workflow_config),
        isSaving: false,
        tables,
        hasUnsavedChanges: false,
      }, () => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this.timer = setTimeout(() => {
          toaster.success(gettext('Workflow saved'));
        }, 1000);
      });
    }).catch(err => {
      const errMessage = err.response.data.error_msg || gettext('Failed to update workflow config');
      toaster.danger(errMessage);
      this.setState({ isSaving: false });
    });
  };

  checkUnConfigLinkColumn = () => {
    let hasUnConfigLinkColumn = false;
    const { workflowConfig, tables } = this.state;
    const { columns_config, table_id, nodes } = workflowConfig || {};
    const table = tables.find(table => table._id === table_id);
    const validWorkflowColumns = getValidWorkflowColumns(table.columns, columns_config || {}, tables, table_id);
    if (validWorkflowColumns.length === 0 || nodes.length === 0) return hasUnConfigLinkColumn;
    let readWriteLinkColumns = [];

    // Get the displayed rw link columns of all nodes
    nodes.forEach(node => {
      const { readWriteColumns } = getShowColumns(validWorkflowColumns, node);
      const linkColumns = readWriteColumns.filter(column => column.type === CellType.LINK);
      if (linkColumns.length === 0) return;
      linkColumns.forEach(linkColumn1 => {
        const targetColumn = readWriteLinkColumns.find(LinkColumn2 => LinkColumn2.key === linkColumn1.key);
        if (!targetColumn) readWriteLinkColumns.push(linkColumn1);
      });
    });
    if (readWriteLinkColumns.length === 0) return hasUnConfigLinkColumn;

    // Check the unConfig visible fields Link column
    for (let i = 0; i < readWriteLinkColumns.length; i++) {
      const column = readWriteLinkColumns[i];
      const { link_visible_column_fields: visibleColumnFields, enable_add_new_records: enableAddNewRecords } = column;
      if (enableAddNewRecords && (!visibleColumnFields || (Array.isArray(visibleColumnFields) && visibleColumnFields.length === 0))) {
        hasUnConfigLinkColumn = true;
        toaster.danger(gettext('Fields visibility of adding new records to the linked table are not configured'));
        break;
      }
    }

    return hasUnConfigLinkColumn;
  };

  // The interface operation directly updates the state, does not automatically saved to the server
  updateWorkflowConfig = async (workflowConfig, type = null) => {
    if (type === 'table') {
      this.dtableUtils.initByConfigTable(workflowConfig);
    }
    this.setState({
      workflowConfig,
      isSaving: false,
      hasUnsavedChanges: true,
    });
  };

  onAddStateField = (fieldName, tableName, callback) => {
    const that = this;
    this.dtableUtils.insertColumn(fieldName, CellType.SINGLE_SELECT, { options: [] }, tableName).then(res => {
      const field = res.data;
      let { tables } = that.state;
      let selectedTable = tables.find(table => table.name === tableName);
      if (!selectedTable) return;
      selectedTable.columns.push(field);
      that.dtableUtils.tables = tables;
      that.dtableUtils.columns = selectedTable.columns;
      that.setState({ tables });
      callback && callback(field);
    }).catch(err => {
      this.handleError(err);
    });
  };

  onAddParticipantsField = (fieldName, tableName, callback) => {
    const that = this;
    this.dtableUtils.insertColumn(fieldName, CellType.COLLABORATOR, null, tableName).then(res => {
      const field = res.data;
      let { tables } = that.state;
      let selectedTable = tables.find(table => table.name === tableName);
      if (!selectedTable) return;
      selectedTable.columns.push(field);
      that.dtableUtils.tables = tables;
      that.dtableUtils.columns = selectedTable.columns;
      that.setState({ tables });
      callback && callback(field);
    }).catch(err => {
      this.handleError(err);
    });
  };

  handleError = (error) => {
    if (error && error.response && error.response.status === 500) {
      const error_msg = error.response.data ? error.response.data['error_msg'] : null;
      if (error_msg && error_msg !== 'Internal Server Error') {
        toaster.danger(error_msg);
        return;
      }
      toaster.danger(gettext('Internal Server Error.'));
      return;
    }
    const errMessage = Utils.getErrorMsg(error);
    toaster.danger(errMessage);
  };

  closeWorkflowSettingsDialog = () => {
    this.setState({ isFirstLoad: false });
  };

  closeParticipantsColumnDialog = () => {
    this.setState({ isParticipantsColumnShow: false });
  };

  render() {
    const { isLoading, errorMessage, isSaving, workflowConfig, isFirstLoad, hasUnsavedChanges,
      tables, workflowRelatedUsers, wechatAccounts, dingtalkAccounts, isParticipantsColumnShow } = this.state;
    if (isLoading) {
      return <div className="d-flex flex-fill align-items-center"><Loading /></div>;
    }

    if (!isLoading && errorMessage) {
      return (
        <div className="d-flex flex-fill align-items-center error-message">
          {errorMessage}
        </div>
      );
    }

    return (
      <Fragment>
        <WorkflowContent
          dtableUtils={this.dtableUtils}
          onSave={this.onSave}
          isSaving={isSaving}
          workflowConfig={workflowConfig}
          tables={tables}
          editorConfig={EDITOR_CONFIG}
          updateWorkflowConfig={this.updateWorkflowConfig}
          hasUnsavedChanges={hasUnsavedChanges}
          workflowRelatedUsers={workflowRelatedUsers}
          wechatAccounts={wechatAccounts}
          dingtalkAccounts={dingtalkAccounts}
          updateWorkflowRelatedUsers={this.updateWorkflowRelatedUsers}
        />
        {isFirstLoad && (
          <NewWorkflowSettingsDialog
            workflowConfig={workflowConfig}
            tables={tables}
            onToggle={this.closeWorkflowSettingsDialog}
            onSubmit={this.updateWorkflowConfig}
            onAddStateField={this.onAddStateField}
            onAddParticipantsField={this.onAddParticipantsField}
          />
        )}
        {isParticipantsColumnShow && (
          <AdditionalParticipantsDialog
            workflowConfig={workflowConfig}
            tables={tables}
            onToggle={this.closeParticipantsColumnDialog}
            onSubmit={this.updateWorkflowConfig}
            onAddParticipantsField={this.onAddParticipantsField}
          />
        )}
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <I18nextProvider i18n={i18n}>
    <Suspense fallback={<Loading/>}>
      <DTableWorkflowEdit />
    </Suspense>
  </I18nextProvider>
);
