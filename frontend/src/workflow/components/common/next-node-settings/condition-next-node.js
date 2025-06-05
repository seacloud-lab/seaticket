import React, { Component } from 'react';
import PropTypes from 'prop-types';
import shallowEqual from 'shallowequal';
import { FormGroup, Label } from 'reactstrap';
import { DTableSelect } from 'dtable-ui-component';
import { NODE_TYPE, WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP } from '../../../constants';
import FiltersPopover from '../../../../pages/dtable/dialog/dataset-widgets/filter-popover';

const gettext = window.gettext;

class ConditionNextNode extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isExpand: true,
    };
    this.initNodes(props);
    this.initColumns(props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { nodes, selectedNode, dtableUtils } = nextProps;
    const isSameNode = shallowEqual(selectedNode, this.props.selectedNode);
    if (!shallowEqual({ 'nodes': nodes }, { 'nodes': this.props.nodes }) || !isSameNode) {
      this.initNodes(nextProps);
    }

    if (!shallowEqual({ 'columns': dtableUtils.columns }, { 'columns': this.props.dtableUtils.columns }) || !isSameNode) {
      this.initColumns(nextProps);
    }
  }

  initNodes = (props) => {
    this.nodeOptions = [];
    const { nodes, selectedNode, conditionNextNode } = props;
    if (!Array.isArray(nodes)) return;
    const conditionalNextNodes = selectedNode.conditional_next_nodes || [];
    this.nodeOptions = nodes.slice(0).filter(node => {
      if (node.type === NODE_TYPE.INIT) return false;
      if (selectedNode && node._id === selectedNode._id) return false;
      if (node.type === NODE_TYPE.CANCELED) return false;
      if (node._id === selectedNode.next_node_id) return false;
      if (node._id === conditionNextNode.next_node_id) return true;
      return !conditionalNextNodes.find(conditionalNextNode => conditionalNextNode.next_node_id === node._id);
    }).map(node => {
      const nodeId = node._id;
      return {
        value: nodeId,
        name: node.name,
        label: (
          <div key={nodeId} className="workflow-app-next-node-select">
            <div className="workflow-app-next-node-name text-truncate">{node.name}</div>
          </div>
        ),
      };
    });
  };

  initColumns = (props) => {
    const { dtableUtils } = props;
    this.columns = dtableUtils.columns.filter(column => WORKFLOW_SUPPORT_VISIBLE_TYPE_MAP[column.type]);
  };

  getSelectedNextNode = () => {
    const { nodes, conditionNextNode } = this.props;
    if (!Array.isArray(nodes) || !conditionNextNode) return {};
    const nextNodeId = conditionNextNode.next_node_id;
    const selected = this.nodeOptions.find(option => option.value === nextNodeId);
    return selected || {};
  };

  onNodeChange = (option) => {
    const nextNodeId = option ? option.value : '';
    const { conditionNextNode } = this.props;
    if (conditionNextNode.next_node_id === nextNodeId) return;
    this.props.onUpdateConditionNextNode(conditionNextNode._id, { next_node_id: nextNodeId });
  };

  onToggleExpand = () => {
    this.setState({ isExpand: !this.state.isExpand });
  };

  onDelete = () => {
    const { conditionNextNode } = this.props;
    this.props.deleteConditionNextNode(conditionNextNode._id);
  };

  toggleFilterPopover = () => {
    this.setState({ isFilterSetterShow: !this.state.isFilterSetterShow });
  };

  updateFilter = (update) => {
    const { conditionNextNode } = this.props;
    this.props.onUpdateConditionNextNode(conditionNextNode._id, update);
  };

  render() {
    const { isExpand } = this.state;
    const { conditionNextNode, workflowRelatedUsers } = this.props;
    const selectedNodeOption = this.getSelectedNextNode();
    const { filters, filter_conjunction: filterConjunction } = conditionNextNode;
    const filterTipId = `next-node-conditions-${conditionNextNode._id}`;
    let filterMessage = gettext('Filter');
    if (filters.length === 1) {
      filterMessage = gettext('1 Filter');
    } else if (filters.length > 1) {
      filterMessage = filters.length + ' ' + gettext('Filters');
    }

    return (
      <div className="mt-2 mb-2">
        <FormGroup key="next-node-settings" className="table-setting next-node-settings">
          <Label className="d-flex align-items-center justify-content-between w-100">
            <span>
              <i
                onClick={this.onToggleExpand}
                className={`settings-common-icon dtable-font mr-2 dtable-icon-down3 ${isExpand ? '' : 'rotate-270'}`}
              >
              </i>
              <span>{gettext('Next node')}</span>
            </span>
            <div className="settings-common-icon d-flex align-items-center justify-content-center" onClick={this.onDelete}>
              <i className="dtable-font dtable-icon-fork-number delete-icon"></i>
            </div>
          </Label>
          <div className={`pl-4 ${isExpand ? 'expanded-next-node-settings' : 'collapsed-next-node-settings d-none'}`}>
            <FormGroup className="next-node-settings-node mb-3">
              <DTableSelect
                classNamePrefix="next-node-settings"
                options={this.nodeOptions}
                onChange={this.onNodeChange}
                value={selectedNodeOption}
                isClearable={selectedNodeOption ? true : false}
              />
            </FormGroup>
            <FormGroup className="next-node-settings-condition">
              <Label>{gettext('Flow condition')}</Label>
              <div
                id={filterTipId}
                className="next-node-conditions"
                onClick={this.toggleFilterPopover}
              >
                <i className="dtable-font dtable-icon-filter mr-2"></i>
                <span>{filterMessage}</span>
              </div>
              {this.state.isFilterSetterShow && (
                <FiltersPopover
                  target={filterTipId}
                  placement="auto-start"
                  columns={this.columns}
                  collaborators={workflowRelatedUsers}
                  filterConjunction={filterConjunction}
                  filters={filters}
                  update={this.updateFilter}
                  hideFilterPopover={this.toggleFilterPopover}
                />
              )}
            </FormGroup>
          </div>
        </FormGroup>
      </div>
    );
  }
}

ConditionNextNode.propTypes = {
  nodes: PropTypes.array,
  dtableUtils: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  selectedNode: PropTypes.object,
  conditionNextNode: PropTypes.object,
  onUpdateConditionNextNode: PropTypes.func,
  deleteConditionNextNode: PropTypes.func,
};

export default ConditionNextNode;
