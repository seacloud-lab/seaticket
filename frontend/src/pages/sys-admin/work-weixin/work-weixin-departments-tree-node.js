import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Dropdown, DropdownItem, DropdownMenu } from 'reactstrap';
import { isPro } from '../../../constants';
import { IconButton, CustomizeDropdownMoreToggle } from '../../../components';

const WorkWeixinDepartmentsTreeNodePropTypes = {
  index: PropTypes.number,
  department: PropTypes.object.isRequired,
  isChildrenShow: PropTypes.bool.isRequired,
  onChangeDepartment: PropTypes.func.isRequired,
  checkedDepartmentId: PropTypes.number.isRequired,
  importDepartmentDialogToggle: PropTypes.func.isRequired,
};

class WorkWeixinDepartmentsTreeNode extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isChildrenShow: false,
      dropdownOpen: false,
      active: false,
    };
  }

  toggleChildren = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({
      isChildrenShow: !this.state.isChildrenShow,
    });
  };

  dropdownToggle = (e) => {
    e.stopPropagation();
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onMouseEnter = () => {
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    if (this.state.dropdownOpen) return;
    this.setState({ active: false });
  };

  importDepartmentDialogToggle = (depart) => {
    this.setState({ active: false });
    this.props.importDepartmentDialogToggle(depart);
  };

  componentDidMount() {
    if (this.props.index === 0) {
      this.setState({ isChildrenShow: true });
      this.props.onChangeDepartment(this.props.department.id);
    }
  }

  renderTreeNodes = (departmentsTree) => {
    if (departmentsTree.length > 0) {
      return departmentsTree.map((department) => {
        return (
          <WorkWeixinDepartmentsTreeNode
            key={department.id}
            department={department}
            isChildrenShow={this.state.isChildrenShow}
            onChangeDepartment={this.props.onChangeDepartment}
            checkedDepartmentId={this.props.checkedDepartmentId}
            importDepartmentDialogToggle={this.importDepartmentDialogToggle}
          />
        );
      });
    }
  };

  changeDept = (departmentID) => {
    const { department, checkedDepartmentId } = this.props;
    this.props.onChangeDepartment(departmentID);
    if (checkedDepartmentId === department.id && !this.state.isChildrenShow) {
      this.setState({ isChildrenShow: true });
    }
  };

  render() {
    const { isChildrenShow, department, checkedDepartmentId } = this.props;
    let nodeInnerClass = classNames({
      'tree-node-inner': true,
      'tree-node-inner-hover': this.state.active,
      'tree-node-hight-light': checkedDepartmentId === department.id
    });
    return (
      <Fragment>
        {isChildrenShow &&
          <div
            className={nodeInnerClass}
            onClick={() => this.changeDept(department.id)}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            <IconButton
              icon={department.children ? 'down' : ''}
              className={classNames('folder-toggle-icon tree-node-icon', { 'rotate-icon-270': !this.state.isChildrenShow })}
              onClick={(e) => this.toggleChildren(e)}
            />
            <span className="tree-node-text">{department.name}</span>
            {isPro &&
            <Dropdown
              isOpen={this.state.dropdownOpen}
              toggle={(e) => this.dropdownToggle(e)}
              direction="down"
              style={this.state.active ? {} : { opacity: 0 }}
            >
              <CustomizeDropdownMoreToggle isOpen={this.state.dropdownOpen} />
              <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu drop-list" right={true}>
                <DropdownItem
                  onClick={this.importDepartmentDialogToggle.bind(this, department)}
                  id={department.id}
                >{'导入部门'}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            }
          </div>
        }
        {this.state.isChildrenShow &&
          <div className="department-children">
            {department.children && this.renderTreeNodes(department.children)}
          </div>
        }
      </Fragment>
    );
  }
}

WorkWeixinDepartmentsTreeNode.propTypes = WorkWeixinDepartmentsTreeNodePropTypes;

export default WorkWeixinDepartmentsTreeNode;
