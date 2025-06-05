import React from 'react';
import PropTypes from 'prop-types';
import NormalNextNode from './normal-next-node';
import ConditionNextNodes from './condition-next-nodes';

function NextNodeSettings(props) {
  const { nodes, selectedNode, conditionalNextNodes, dtableUtils, workflowRelatedUsers } = props;

  return (
    <>
      <NormalNextNode
        nodes={nodes}
        selectedNode={selectedNode}
        onNextNodeChange={props.onNextNodeChange}
      />
      <ConditionNextNodes
        nodes={nodes}
        dtableUtils={dtableUtils}
        workflowRelatedUsers={workflowRelatedUsers}
        selectedNode={selectedNode}
        conditionalNextNodes={conditionalNextNodes}
        onUpdateConditionNextNodes={props.onUpdateConditionNextNodes}
      />
    </>
  );
}

NextNodeSettings.propTypes = {
  nodes: PropTypes.array,
  dtableUtils: PropTypes.object,
  workflowRelatedUsers: PropTypes.array,
  conditionalNextNodes: PropTypes.array,
  selectedNode: PropTypes.object,
  onNextNodeChange: PropTypes.func,
  onUpdateConditionNextNodes: PropTypes.func,
};

export default NextNodeSettings;
