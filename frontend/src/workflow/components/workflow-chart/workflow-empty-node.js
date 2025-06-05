import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { NODE_WIDTH, NODE_HEIGHT } from '../../constants';

function WorkflowEmptyNode(props) {
  const { className, style } = props;
  return (
    <div
      className={classnames('workflow-app-node workflow-app-empty-node position-relative', className)}
      style={{
        ...style,
        height: NODE_HEIGHT,
        width: NODE_WIDTH,
      }}
    >
    </div>
  );
}

WorkflowEmptyNode.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};

export default WorkflowEmptyNode;
