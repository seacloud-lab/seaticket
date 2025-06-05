import React from 'react';
import PropTypes from 'prop-types';
import WorkflowNodeLRChart from './workflow-node-left-to-right';
import WorkflowNodeTBChart from './workflow-node-top-to-bottom';
import { NODE_DIRECTION } from '../../constants';

function WorkflowChart(props) {
  const { direction, ...otherProps } = props;
  if (direction === NODE_DIRECTION.LR) {
    return (<WorkflowNodeLRChart { ...otherProps } />);
  }
  if (direction === NODE_DIRECTION.TB) {
    return (<WorkflowNodeTBChart { ...otherProps } />);
  }
  return null;
}

WorkflowChart.defaultProps = {
  direction: NODE_DIRECTION.TB,
};

WorkflowChart.propTypes = {
  direction: PropTypes.string,
};

export default WorkflowChart;
