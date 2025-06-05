import React, { Component } from 'react';
import PropTypes from 'prop-types';
import DepartmentsV2TreeNode from './departments-v2-tree-node';
import DepartmentNode from '../../dtable/model/department-node';
import { gettext } from '../../../utils/constants';

const DepartmentV2TreePanelPropTypes = {
  rootNode: PropTypes.object,
  checkedDepartmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChangeDepartment: PropTypes.func,
  listSubDepartments: PropTypes.func,
  toggleAddDepartment: PropTypes.func,
  toggleAddMembers: PropTypes.func,
  toggleRename: PropTypes.func,
  toggleDelete: PropTypes.func
};

class DepartmentV2TreePanel extends Component {
  render() {
    const { rootNode, checkedDepartmentId } = this.props;
    const otherUsersNode = new DepartmentNode({
      id: 'other_users',
      name: gettext('Other users')
    });
    return (
      <div className="departments-tree-panel">
        <DepartmentsV2TreeNode
          node={rootNode}
          checkedDepartmentId={checkedDepartmentId}
          onChangeDepartment={this.props.onChangeDepartment}
          listSubDepartments={this.props.listSubDepartments}
          toggleAddDepartment={this.props.toggleAddDepartment}
          toggleAddMembers={this.props.toggleAddMembers}
          toggleRename={this.props.toggleRename}
          toggleDelete={this.props.toggleDelete}
        />
        <DepartmentsV2TreeNode
          node={otherUsersNode}
          checkedDepartmentId={checkedDepartmentId}
          onChangeDepartment={this.props.onChangeDepartment}
          listSubDepartments={this.props.listSubDepartments}
          toggleAddDepartment={this.props.toggleAddDepartment}
          toggleAddMembers={this.props.toggleAddMembers}
          toggleRename={this.props.toggleRename}
          toggleDelete={this.props.toggleDelete}
        />
      </div>
    );
  }
}

DepartmentV2TreePanel.propTypes = DepartmentV2TreePanelPropTypes;

export default DepartmentV2TreePanel;
