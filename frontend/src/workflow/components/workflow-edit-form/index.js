import React from 'react';
import PropTypes from 'prop-types';
import shallowEqual from 'shallowequal';
import eventBus from '../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../constants/event-operation-type';
import { getValidWorkflowColumns } from '../../utils/utils';
import WorkflowSelectNodeTip from './workflow-select-node-tip';
import WorkflowNodeColumnsEdit from './workflow-node-columns-edit';

import './index.css';
import '../../css/readonly-columns.css';

class WorkflowEditForm extends React.Component {

  constructor(props) {
    super(props);
    const { tableColumns, workflowConfig, tables } = props;
    const { columns_config, state_column_key = '', table_id } = workflowConfig || {};
    const validWorkflowColumns = getValidWorkflowColumns(tableColumns, columns_config || {}, tables, table_id);
    this.state = {
      isShowWorkflowColumns: true,
      workflowColumns: validWorkflowColumns.filter(column => column.key !== state_column_key)
    };
  }

  componentDidMount() {
    this.selectedNodeEvent = eventBus.subscribe(EVENT_OPERATION_TYPE.SELECT_WORKFLOW_NODE, this.onSelectedNode);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { workflowConfig, tableColumns } = nextProps;
    const { columns_config: newColumnConfig, state_column_key: newStateColumnKey, table_id } = workflowConfig;
    const { workflowConfig: oldWorkflowConfig, tables } = this.props;
    const { columns_config: oldColumnConfig, state_column_key: oldStateColumnKey } = oldWorkflowConfig;
    if (!shallowEqual(newColumnConfig, oldColumnConfig) || newStateColumnKey !== oldStateColumnKey) {
      const validWorkflowColumns = getValidWorkflowColumns(tableColumns, newColumnConfig || {}, tables, table_id);
      this.setState({ workflowColumns: validWorkflowColumns.filter(column => column.key !== newStateColumnKey) });
    }
  }

  componentWillUnmount() {
    this.selectedNodeEvent();
  }

  onSelectedNode = () => {
    this.setState({ isShowWorkflowColumns: false });
  };

  render() {
    const { isShowWorkflowColumns, workflowColumns } = this.state;
    const { workflowConfig, editorConfig, selectedNode } = this.props;
    if (isShowWorkflowColumns) return <WorkflowSelectNodeTip />;
    return (
      <WorkflowNodeColumnsEdit
        workflowConfig={workflowConfig}
        selectedNode={selectedNode}
        workflowColumns={workflowColumns}
        editorConfig={editorConfig}
        changeNode={this.props.changeNode}
        updateWorkflowConfig={this.props.updateWorkflowConfig}
      />
    );
  }
}

WorkflowEditForm.propTypes = {
  selectedNode: PropTypes.object,
  workflowConfig: PropTypes.object,
  tables: PropTypes.array,
  tableColumns: PropTypes.array,
  editorConfig: PropTypes.object.isRequired,
  changeNode: PropTypes.func,
  updateWorkflowConfig: PropTypes.func,
};

export default WorkflowEditForm;
