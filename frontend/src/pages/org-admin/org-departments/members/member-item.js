import React from 'react';
import PropTypes from 'prop-types';
import { RoleStatusEditor, toaster } from 'dtable-ui-component';
import { gettext, orgID, serviceURL } from '../../../../utils/constants';
import { orgAdminServiceApi } from '../../../../api/org-admin-service-api';
import { Utils } from '../../../../utils/utils';
import { getRoleOptions } from '../../../../utils/role-status-utils';

const propTypes = {
  groupID: PropTypes.string.isRequired,
  member: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onMemberChanged: PropTypes.func.isRequired,
  showDeleteMemberDialog: PropTypes.func.isRequired,
  toggleItemFreezed: PropTypes.func.isRequired,
};

class MemberItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      showRoleMenu: false,
    };
    this.roles = ['Admin', 'Member'];
  }

  onMouseEnter = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ highlight: true });
  };

  onMouseLeave = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ highlight: false });
  };

  toggleMemberRoleMenu = () => {
    this.setState({ showRoleMenu: !this.state.showRoleMenu });
  };

  onChangeUserRole = (role) => {
    const isAdmin = role === 'Admin' ? true : false;
    orgAdminServiceApi.orgAdminSetGroupMemberRole(orgID, this.props.groupID, this.props.member.email, isAdmin).then((res) => {
      this.props.onMemberChanged();
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
    this.setState({
      highlight: false,
    });
  };

  render() {
    const { member, isItemFreezed } = this.props;
    const { highlight } = this.state;
    const memberLink = `${serviceURL}/org/useradmin/info/${member.email}/}`;
    if (member.role === 'Owner') return null;
    const options = getRoleOptions(this.roles) || [];
    const option = options.find(item => item.value === member.role) || {};

    return (
      <tr
        className={highlight ? 'tr-highlight' : ''}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <td>
          <img src={member.avatar_url} alt="member-header" className="avatar" />
        </td>
        <td>
          <a href={memberLink}>{member.name}</a>
        </td>
        <td className="p-0">
          <RoleStatusEditor
            isShowDropdownIcon={highlight}
            currentOption={option}
            menuOptions={options}
            onChangeOption={this.onChangeUserRole}
            closeShowDropdownIcon={this.onMouseLeave}
          />
        </td>
        {!isItemFreezed ? (
          <td
            className="cursor-pointer text-center"
            onClick={this.props.showDeleteMemberDialog.bind(this, member)}
          >
            <span
              className={`dtable-font dtable-icon-x action-icon ${
                highlight ? '' : 'vh'
              }`}
              title={gettext('Delete')}
              aria-label={gettext('Delete')}
            >
            </span>
          </td>
        ) : (
          <td></td>
        )}
      </tr>
    );
  }
}

MemberItem.propTypes = propTypes;

export default MemberItem;
