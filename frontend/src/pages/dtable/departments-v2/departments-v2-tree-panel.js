import React from 'react';
import PropTypes from 'prop-types';
import DepartmentV2TreeNode from './departments-v2-tree-node';

export default class DepartmentsV2TreePanel extends React.Component {

  static propTypes = {
    currentRootNode: PropTypes.object,
    rootNodes: PropTypes.array,
    checkedDepartmentId: PropTypes.number,
    onChangeDepartment: PropTypes.func
  };

  render() {
    const { currentRootNode, rootNodes, checkedDepartmentId } = this.props;
    return (
      <div className="departments-tree-panel">
        {rootNodes.map(rootNode => {
          return (
            <DepartmentV2TreeNode
              key={rootNode.id}
              rootNode={rootNode}
              currentRootNode={currentRootNode}
              node={rootNode}
              checkedDepartmentId={checkedDepartmentId}
              onChangeDepartment={this.props.onChangeDepartment}
            />
          );
        })}
      </div>
    );
  }
}
