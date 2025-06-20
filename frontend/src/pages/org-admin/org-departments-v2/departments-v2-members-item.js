import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { RoleStatusEditor } from 'dtable-ui-component';
import { gettext, siteRoot } from '../../../constants';
import { getRoleOptions } from '../../../utils/role-status-utils';

const propTypes = {
  isItemFreezed: PropTypes.bool,
  member: PropTypes.object,
  setMemberStaff: PropTypes.func,
  deleteMember: PropTypes.func,
  unfreezeItem: PropTypes.func,
  freezeItem: PropTypes.func,
  toggleItemFreezed: PropTypes.func,
  isOtherUsers: PropTypes.bool,
  toggleAddUserToDepartments: PropTypes.func,
};

class DepartmentsV2MembersItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      dropdownOpenEmail: '',
      isShowDropdownMenu: false,
      isItemMenuShow: false,
    };
    this.roles = ['Admin', 'Member'];
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isShowDropdownMenu: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isShowDropdownMenu: false });
    }
  };

  setMemberStaff = (role) => {
    const { member } = this.props;
    this.props.setMemberStaff(member.email, role === 'Admin');
  };

  deleteMember = (e) => {
    e.stopPropagation();
    const { member } = this.props;
    this.props.deleteMember(member.email);
  };

  addToDepartments = (e) => {
    e.stopPropagation();
    const { member } = this.props;
    this.props.toggleAddUserToDepartments(member);
  };

  toggleDropdownMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow && typeof(this.props.freezeItem) === 'function') {
        this.props.freezeItem();
      } else if (!this.state.isItemMenuShow && typeof(this.props.unfreezeItem) === 'function') {
        this.props.unfreezeItem();
      }
    });
  };

  translateRole = (role) => {
    if (role === 'Admin') {
      return gettext('Admin');
    } else if (role === 'Member') {
      return gettext('Default member');
    }
  };

  render() {
    const { member, isOtherUsers } = this.props;
    const { isShowDropdownMenu, isItemMenuShow } = this.state;
    const currentRole = member.is_staff ? 'Admin' : 'Member';
    const options = getRoleOptions(this.roles) || [];
    const option = options.find(option => option.value === currentRole) || {};

    return (
      <tr key={member.email} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td><img className="avatar" src={member.avatar_url} alt=""></img></td>
        <td className='text-truncate'>
          <Link to={`${siteRoot}org/useradmin/info/${encodeURIComponent(member.email)}/`}>{member.name}</Link>
        </td>
        {!isOtherUsers &&
          <td>
            <RoleStatusEditor
              isShowDropdownIcon={isShowDropdownMenu}
              currentOption={option}
              menuOptions={options}
              onChangeOption={this.setMemberStaff}
              closeShowDropdownIcon={this.onMouseLeave}
            />
          </td>
        }
        <td>{member.contact_email}</td>
        <td>
          {isShowDropdownMenu &&
            <Dropdown
              isOpen={isItemMenuShow}
              toggle={this.toggleDropdownMenu}
              direction="down"
            >
              <DropdownToggle
                tag='a'
                role="button"
                className='attr-action-icon dtable-font dtable-icon-more-vertical'
                title={gettext('More operations')}
                aria-label={gettext('More operations')}
                data-toggle="dropdown"
              />
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu mt-2 mr-2" right={true}>
                {!isOtherUsers &&
                  <DropdownItem key='delete' onClick={this.deleteMember}>{gettext('Delete')}</DropdownItem>
                }
                {isOtherUsers &&
                  <DropdownItem key='add-to-departments' onClick={this.addToDepartments}>{gettext('Add to departments')}</DropdownItem>
                }
              </DropdownMenu>
            </Dropdown>
          }
        </td>
      </tr>
    );
  }
}

DepartmentsV2MembersItem.propTypes = propTypes;

export default DepartmentsV2MembersItem;
