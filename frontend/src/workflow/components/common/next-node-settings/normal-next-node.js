import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label } from 'reactstrap';
import { DTableSelect } from 'dtable-ui-component';
import { NODE_TYPE } from '../../../constants';

const gettext = window.gettext;

class NormalNextNode extends Component {

  generatorNextNodeOptions = () => {
    const { nodes, selectedNode } = this.props;
    if (!Array.isArray(nodes) || !selectedNode) return [];
    const conditionalNextNodes = selectedNode.conditional_next_nodes || [];
    return nodes.slice(0).filter(node => {
      if (node.type === NODE_TYPE.INIT) return false;
      if (node._id === selectedNode._id) return false;
      if (node.type === NODE_TYPE.CANCELED) return false;
      if (node._id === selectedNode.next_node_id) return true;
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

  getSelectedNextNode = (options) => {
    const { selectedNode, nodes } = this.props;
    if (!Array.isArray(nodes) || !selectedNode) return [];
    const nextNodeId = selectedNode.next_node_id;
    const selected = options.find(option => option.value === nextNodeId);
    return selected || {};
  };

  onNextNodeChange = (option) => {
    const nextNode = option ? option.value : '';
    this.props.onNextNodeChange(nextNode);
  };

  render() {
    const options = this.generatorNextNodeOptions();
    const value = this.getSelectedNextNode(options);
    return (
      <FormGroup key="next-node-settings" className="setting-item table-setting next-node-settings">
        <Label>{gettext('Next node')}</Label>
        <DTableSelect
          classNamePrefix="next-node-settings"
          options={options}
          onChange={this.onNextNodeChange}
          value={value}
          isClearable={value ? true : false}
        />
      </FormGroup>
    );
  }
}

NormalNextNode.propTypes = {
  selectedNode: PropTypes.object,
  nodes: PropTypes.array,
  onNextNodeChange: PropTypes.func,
};

export default NormalNextNode;
