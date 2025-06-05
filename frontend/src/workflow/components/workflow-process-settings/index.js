import React, { Component } from 'react';
import PropTypes from 'prop-types';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';
import { getValidWorkflowColumns, getShowColumns } from '../../utils/utils';
import FieldSettings from './field-settings';
import NodeSettings from './node-settings';
import WorkflowSettings from './workflow-settings';

class WorkflowProcessSettings extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowWorkflowSettings: true,
      isShowFormFieldSettings: false,
      selectedColumnKey: ''
    };
  }

  componentDidMount() {
    this.selectedNodeEvent = eventBus.subscribe(EVENT_OPERATION_TYPE.SELECT_WORKFLOW_NODE, this.showNodeSettings);
    this.selectedFieldEvent = eventBus.subscribe(EVENT_OPERATION_TYPE.SELECT_WORKFLOW_FORM_FIELD, this.onSelectedFormField);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { selectedNode: newSelectedNode } = nextProps;
    const { selectedNode } = this.props;
    if ( selectedNode && newSelectedNode && newSelectedNode._id !== selectedNode._id) {
      this.setState({ isShowFormFieldSettings: false, selectedColumnKey: '' });
    }
  }

  componentWillUnmount() {
    this.selectedNodeEvent();
    this.selectedFieldEvent();
  }

  showNodeSettings = () => {
    this.setState({ isShowWorkflowSettings: false, isShowFormFieldSettings: false });
  };

  onSelectedFormField = (columnIdx) => {
    const allColumns = this.getAllColumns();
    const selectedColumn = allColumns[columnIdx];
    const selectedColumnKey = selectedColumn.key;
    this.setState({ isShowWorkflowSettings: false, isShowFormFieldSettings: true, selectedColumnKey });
  };

  getAllColumns = () => {
    const { dtableUtils, workflowConfig, selectedNode, tables } = this.props;
    const tableColumns = dtableUtils.columns;
    const { columns_config, state_column_key = '', table_id = '' } = workflowConfig || {};
    const validWorkflowColumns = getValidWorkflowColumns(tableColumns, columns_config || {}, tables, table_id);
    const workflowColumns = validWorkflowColumns.filter(column => column.key !== state_column_key);
    const { allColumns } = getShowColumns(workflowColumns, selectedNode);
    return allColumns;
  };

  showWorkflowSettings = () => {
    this.setState({ isShowWorkflowSettings: true });
  };

  render() {
    const { isShowWorkflowSettings, isShowFormFieldSettings } = this.state;
    const { workflowConfig, selectedNode, workflowRelatedUsers, tables, nodes, dtableUtils, wechatAccounts, dingtalkAccounts } = this.props;

    if (isShowWorkflowSettings || !selectedNode) {
      return (
        <WorkflowSettings
          workflowConfig={workflowConfig}
          tables={tables}
          wechatAccounts={wechatAccounts}
          dingtalkAccounts={dingtalkAccounts}
          updateWorkflowConfig={this.props.updateWorkflowConfig}
        />
      );
    }

    if (isShowFormFieldSettings) {
      const allColumns = this.getAllColumns();
      const { selectedColumnKey } = this.state;
      return (
        <FieldSettings
          workflowConfig={workflowConfig}
          tables={tables}
          selectedColumnKey={selectedColumnKey}
          allColumns={allColumns}
          showNodeSettings={this.showNodeSettings}
          updateWorkflowConfig={this.props.updateWorkflowConfig}
        />
      );
    }

    return (
      <NodeSettings
        selectedNode={selectedNode}
        workflowRelatedUsers={workflowRelatedUsers}
        workflowConfig={workflowConfig}
        dtableUtils={dtableUtils}
        nodes={nodes}
        showWorkflowSettings={this.showWorkflowSettings}
        changeNode={this.props.changeNode}
        updateWorkflowConfig={this.props.updateWorkflowConfig}
        updateWorkflowRelatedUsers={this.props.updateWorkflowRelatedUsers}
      />
    );
  }
}

WorkflowProcessSettings.propTypes = {
  selectedNode: PropTypes.object,
  workflowConfig: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  tables: PropTypes.array,
  nodes: PropTypes.array,
  dtableUtils: PropTypes.object,
  wechatAccounts: PropTypes.array,
  dingtalkAccounts: PropTypes.array,
  changeNode: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
  updateWorkflowRelatedUsers: PropTypes.func,
};

export default WorkflowProcessSettings;
