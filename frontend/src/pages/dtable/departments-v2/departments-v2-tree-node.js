import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const propTypes = {
  rootNode: PropTypes.object,
  currentRootNode: PropTypes.object,
  node: PropTypes.object,
  checkedDepartmentId: PropTypes.number,
  onChangeDepartment: PropTypes.func
};

class DepartmentV2TreeNode extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isChildrenShow: false,
      active: false,
    };
  }

  toggleChildren = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.state.isChildrenShow) {
      this.setState({ isChildrenShow: false });
      return;
    }
    this.setState({ isChildrenShow: true });
  };

  changeDept = (nodeId) => {
    const { node, checkedDepartmentId, rootNode } = this.props;
    const { isChildrenShow } = this.state;
    if (checkedDepartmentId !== node.id) {
      this.props.onChangeDepartment(rootNode, nodeId);
    }
    if (checkedDepartmentId === node.id) {
      if (isChildrenShow) {
        this.setState({ isChildrenShow: false });
        return;
      }
      this.setState({ isChildrenShow: true });
    }
  };

  renderTreeNodes = (nodes) => {
    const { rootNode, currentRootNode } = this.props;
    if (nodes.length > 0) {
      return nodes.map((node) => {
        return (
          <DepartmentV2TreeNode
            key={`${node.id}`}
            rootNode={rootNode}
            currentRootNode={currentRootNode}
            node={node}
            onChangeDepartment={this.props.onChangeDepartment}
            checkedDepartmentId={this.props.checkedDepartmentId}
          />
        );
      });
    }
  };

  render() {
    const { node, checkedDepartmentId } = this.props;
    const { isChildrenShow } = this.state;
    let nodeInnerClass = classNames({
      'departments-v2-tree-item': true,
      'departments-v2-hight-light': checkedDepartmentId === node.id
    });
    return (
      <Fragment>
        <div
          className={nodeInnerClass}
          onClick={() => this.changeDept(node.id)}
        >
          <span className="departments-v2-tree-icon" onClick={(e) => this.toggleChildren(e)}>
            <i className={`folder-toggle-icon dtable-font dtable-icon-down3 ${isChildrenShow ? '' : 'rotate-270'}`}></i>
          </span>
          <span className="departments-v2-tree-node-text text-truncate">{node.name}</span>
        </div>
        {this.state.isChildrenShow &&
          <div className="department-children">
            {node.children && this.renderTreeNodes(node.children)}
          </div>
        }
      </Fragment>
    );
  }
}

DepartmentV2TreeNode.propTypes = propTypes;

export default DepartmentV2TreeNode;
