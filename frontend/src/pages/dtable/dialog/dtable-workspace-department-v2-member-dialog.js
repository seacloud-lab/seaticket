import React, { Fragment } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { seaQAAPI } from '../../../api/web-api';
import User from '../model/user';
import { gettext } from '../../../constants/config';
import { Utils } from '../../../utils/utils';

import '../../../css/dtable-workspace-member-tree-dialog.css';

class DepartmentItem extends React.Component {

  static propTypes = {
    currentLevel: PropTypes.number,
    groupMembersItem: PropTypes.object,
    getMembersAndSubDepartments: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      isExpanded: props.currentLevel >= 1 ? false : true
    };
  }

  onExpand = async () => {
    try {
      await this.props.getMembersAndSubDepartments(this.props.groupMembersItem.department.id);
      this.setState({ isExpanded: !this.state.isExpanded });
    } catch (error) {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    }
  };

  renderSubDepartments = () => {
    const { groupMembersItem, currentLevel } = this.props;
    const subDepartments = groupMembersItem.sub_departments || [];
    return (
      subDepartments.map((subGroupMembersItem) => {
        const { department } = subGroupMembersItem;
        return (
          <DepartmentItem
            key={department.id}
            currentLevel={currentLevel + 1}
            groupMembersItem={subGroupMembersItem}
            getMembersAndSubDepartments={this.props.getMembersAndSubDepartments}
          />
        );
      })
    );
  };

  renderMembers = () => {
    const { groupMembersItem, currentLevel } = this.props;
    const paddingLeft = (currentLevel + 1) * 20 + 16;
    const members = groupMembersItem.members || [];
    return (
      members.map(gMember => {
        const member = new User(gMember);
        return (
          <div key={member.email} className="member-details" style={{ paddingLeft }}>
            <img src={member.avatar_url} alt={member.name} className="member-avatar" />
            <span className="member-name">{member.name}</span>
          </div>
        );
      })
    );
  };

  render() {
    const { isExpanded } = this.state;
    const { groupMembersItem, currentLevel } = this.props;
    const { department } = groupMembersItem;
    const paddingLeft = currentLevel * 20 + 16;
    return (
      <Fragment key={department.id}>
        <div
          className='member-details group-item'
          style={{ paddingLeft }}
        >
          <div className='d-flex align-items-center'>
            <span
              className={`expand dtable-font dtable-icon-down3 ${isExpanded ? '' : 'rotate-270'}`}
              onClick={this.onExpand}
            >
            </span>
            <span className="pl-2">{groupMembersItem.department.name}</span>
          </div>
        </div>
        {isExpanded && this.renderMembers()}
        {isExpanded && this.renderSubDepartments()}
      </Fragment>
    );
  }
}

export default class DTableWorkspaceDepartmentV2MemberDialog extends React.Component {

  static propTypes = {
    workspace: PropTypes.object,
    onGroupMemberToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      groupMembers: {
        department: {
          id: props.workspace.department_id,
          name: props.workspace.name
        },
        members: null,
        sub_departments: null
      },
      count: 0,
      isLoading: true,
    };
  }

  async componentDidMount() {
    try {
      const res = await seaQAAPI.getAddressBookV2DepartmentGroupMembersCount(this.props.workspace.group_id);
      this.setState({ count: res.data.count });
      await this.getMembersAndSubDepartments(this.props.workspace.department_id);
      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({ isLoading: false });
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    }
  }

  getMembersAndSubDepartments = async (department_id) => {
    try {
      const newGroupMembers = Object.assign({}, this.state.groupMembers);
      const queue = [newGroupMembers];
      let targetDep;
      while (queue.length > 0) {
        const dep = queue.shift();
        if (dep.department.id === department_id) {
          targetDep = dep;
          break;
        }
        queue.push(...(dep.sub_departments || []));
      }
      if (targetDep && targetDep.members && targetDep.sub_departments) {
        return;
      }
      let res = await seaQAAPI.listAddressBookV2DepartmentMembers(department_id);
      const members = res.data.member_list;
      res = await seaQAAPI.listAddressBookV2SubDepartments(department_id);
      const subDepartments = res.data.department_list;
      targetDep.members = members;
      targetDep.sub_departments = subDepartments.map(item => {
        return {
          department: item,
          members: null,
          sub_departments: null
        };
      });
      this.setState({ groupMembers: newGroupMembers });
    } catch (error) {
      this.setState({ isLoading: false });
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    }
  };

  toggle = () => {
    this.props.onGroupMemberToggle();
  };

  render() {
    const { count, isLoading, groupMembers } = this.state;
    if (isLoading) {
      return (
        <Modal isOpen={true} toggle={this.toggle} className="dtable-group-member-tree-content">
          <DTableModalHeader toggle={this.toggle}>{gettext('Group members')}</DTableModalHeader>
          <ModalBody className='group-members'>
            <div className="my-4">
              <Loading />
            </div>
          </ModalBody>
        </Modal>
      );
    }
    return (
      <Modal isOpen={true} toggle={this.toggle} className="dtable-group-member-tree-content">
        <DTableModalHeader toggle={this.toggle}>{gettext('Group members') + ` (${count})`}</DTableModalHeader>
        <ModalBody className={classnames('group-members')}>
          <DepartmentItem
            groupMembersItem={groupMembers}
            currentLevel={0}
            getMembersAndSubDepartments={this.getMembersAndSubDepartments}
          />
        </ModalBody>
      </Modal>
    );
  }
}
