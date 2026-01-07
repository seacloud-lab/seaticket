import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactstrap';
import { IconButton, ActiveStatusEditor, toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { gettext, username } from '@/constants/config';
import homeAPI from '../api';
import { getRoleOptions } from '@/utils/role-status-utils';

const propTypes = {
  groupMembers: PropTypes.array.isRequired,
  groupID: PropTypes.number.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  toggleItemFreezed: PropTypes.func.isRequired,
  changeMember: PropTypes.func.isRequired,
  deleteMember: PropTypes.func.isRequired
};

class GroupMembers extends React.Component {

  render() {
    const { groupMembers, groupID, isOwner, isAdmin, isItemFreezed, toggleItemFreezed, changeMember, deleteMember } = this.props;
    return (
      <Table size="sm" className="manage-members-table">
        <thead>
          <tr>
            <th width="8%"></th>
            <th width="45%">{gettext('Name')}</th>
            <th width="37%">{gettext('Role')}</th>
            <th width="10%"></th>
          </tr>
        </thead>
        <tbody>
          {groupMembers.map((item, index) => {
            return (
              <Member
                key={index}
                memberItem={item}
                deleteMember={deleteMember}
                groupID={groupID}
                isOwner={isOwner}
                isAdmin={isAdmin}
                isItemFreezed={isItemFreezed}
                toggleItemFreezed={toggleItemFreezed}
                changeMember={changeMember}
              />
            );
          })
          }
        </tbody>
      </Table>
    );
  }
}

GroupMembers.propTypes = propTypes;

const MemberPropTypes = {
  memberItem: PropTypes.object.isRequired,
  deleteMember: PropTypes.func.isRequired,
  changeMember: PropTypes.func.isRequired,
  groupID: PropTypes.number.isRequired,
  isOwner: PropTypes.bool.isRequired,
  isAdmin: PropTypes.bool.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  toggleItemFreezed: PropTypes.func.isRequired
};

class Member extends React.PureComponent {

  constructor(props) {
    super(props);
    this.roles = ['Admin', 'Member'];
    this.state = ({
      highlight: false,
    });
  }

  onChangeUserRole = (role) => {
    let isAdmin = role === 'Admin' ? 'True' : 'False';
    homeAPI.setGroupAdmin(this.props.groupID, this.props.memberItem.email, isAdmin).then((res) => {
      this.props.changeMember(res.data);
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
    this.setState({
      highlight: false,
    });
  };

  deleteMember = (name) => {
    const { memberItem } = this.props;
    homeAPI.deleteGroupMember(this.props.groupID, name).then((res) => {
      this.props.deleteMember(memberItem);
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  handleMouseOver = () => {
    if (this.props.isItemFreezed) return;
    this.setState({
      highlight: true,
    });
  };

  handleMouseLeave = () => {
    if (this.props.isItemFreezed) return;
    this.setState({
      highlight: false,
    });
  };

  translateRole = (role) => {
    if (role === 'Admin') {
      return gettext('Admin');
    }
    else if (role === 'Member') {
      return gettext('Member');
    }
    else if (role === 'Owner') {
      return gettext('Owner');
    }
  };

  render() {
    const { memberItem, isOwner, isAdmin, isItemFreezed } = this.props;
    const { highlight } = this.state;
    let showRoleEditor = false;
    if (isOwner && memberItem.role !== 'Owner') {
      showRoleEditor = true;
    } else if (isAdmin && memberItem.role !== 'Owner' && memberItem.email !== username) {
      showRoleEditor = true;
    }
    const deleteAuthority = (memberItem.role !== 'Owner' && isOwner === true) || (memberItem.role === 'Member' && isOwner === false);
    const options = getRoleOptions(this.roles) || [];
    const option = options.find(item => item.value === memberItem.role) || {};
    return (
      <tr onMouseOver={this.handleMouseOver} onMouseLeave={this.handleMouseLeave} className={highlight ? 'editing' : ''}>
        <th scope="row"><img className="avatar" src={memberItem.avatar_url} alt=""/></th>
        <td className="group-member-name">{memberItem.name}</td>
        <td>
          {!showRoleEditor && (
            <span className="group-admin">{this.translateRole(memberItem.role)}</span>
          )}
          {showRoleEditor && (
            <ActiveStatusEditor
              isShowDropdownIcon={highlight}
              currentOption={option}
              menuOptions={options}
              onChangeOption={this.onChangeUserRole}
              closeShowDropdownIcon={this.handleMouseLeave}
            />
          )}
        </td>
        <td>
          {(deleteAuthority && !isItemFreezed) && (
            <IconButton icon="close" className="delete-group-member-icon" name={memberItem.email} onClick={this.deleteMember.bind(this, memberItem.email)} />
          )}
        </td>
      </tr>
    );
  }
}

Member.propTypes = MemberPropTypes;

export default GroupMembers;
