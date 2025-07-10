import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { enableAddressBookV2 } from '../../constants/config';
import { canAddProject, disableAddingPersonalProjects } from '../../constants';
import './header-dropdown-menu.css';

const gettext = window.gettext;
const { isOrgContext } = window.app.pageOptions;

class HeaderDropdownMenu extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
      active: false,
    };
  }

  dropdownToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onRenameToggle = () => {
    this.props.onRenameGroupToggle();
  };

  onManageMembersToggle = () => {
    this.props.onManageMembersToggle();
    this.props.onDtableManageMembers();
  };

  onTransferGroupToggle = () => {
    this.props.onTransferGroupToggle();
  };

  onDeleteGroupToggle = (workspace) => {
    this.props.onDeleteGroupToggle(workspace);
  };

  onLeaveGroupToggle = (workspace) => {
    this.props.onLeaveGroupToggle(workspace);
  };

  openInviteDialog = () => {
    this.props.toggleGroupInviteDialog();
  };

  openTrashDialog = () => {
    this.props.toggleGroupTrashDialog();
  };

  render() {
    const { isOwner, isPersonal, isAdmin, isOwnerOrAdmin, workspace, isDepart, showGroupOptions } = this.props;
    const isDepartV2Group = enableAddressBookV2 && workspace.department_id;

    let showAddProject = false;
    if (canAddProject && isPersonal && !disableAddingPersonalProjects) {
      showAddProject = true;
    }
    if (canAddProject && !isPersonal && (isOwner || isAdmin)) {
      showAddProject = true;
    }

    return (
      <Dropdown
        isOpen={this.state.dropdownOpen}
        toggle={this.dropdownToggle}
        direction="down"
        className="header-more-operation sea-qa-icon-btn"
      >
        <DropdownToggle
          tag='i'
          role="button"
          className='cursor-pointer'
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.dropdownOpen}
          aria-haspopup={true}
          tabIndex={0}
        >
          <i className="dtable-font dtable-icon-new"></i>
          <i className="dtable-font dtable-icon-down3"></i>
        </DropdownToggle>
        <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu drop-list">
          {showAddProject &&
            <DropdownItem onClick={this.props.showVirtualProject}>{gettext('Add a blank project')}</DropdownItem>
          }
          {isOwner && showGroupOptions &&
            <DropdownItem onClick={this.onRenameToggle}>{gettext('Rename')}</DropdownItem>
          }
          {(!isDepart || isDepartV2Group) && showGroupOptions &&
            <DropdownItem onClick={this.props.openGroupMember}>{gettext('Group members')}</DropdownItem>
          }
          {!isDepart && isOwnerOrAdmin && !isDepartV2Group && showGroupOptions &&
            <DropdownItem onClick={this.onManageMembersToggle}>{gettext('Manage members')}</DropdownItem>
          }
          {!isOrgContext && isOwnerOrAdmin && !isDepartV2Group && showGroupOptions &&
            <DropdownItem onClick={this.openInviteDialog}>{gettext('Invite members')}</DropdownItem>
          }
          {isOwner && showGroupOptions &&
            <DropdownItem onClick={this.onTransferGroupToggle}>{gettext('Transfer')}</DropdownItem>
          }
          {isOwner && showGroupOptions &&
            <DropdownItem onClick={this.onDeleteGroupToggle.bind(workspace)}>{gettext('Delete group')}</DropdownItem>
          }
          {!isDepart && !isOwner && !isDepartV2Group && showGroupOptions &&
            <DropdownItem onClick={this.onLeaveGroupToggle.bind(workspace)}>{gettext('Leave group')}</DropdownItem>
          }
          {isOwnerOrAdmin && showGroupOptions &&
            <DropdownItem onClick={this.openTrashDialog}>{gettext('Trash')}</DropdownItem>
          }
        </DropdownMenu>
      </Dropdown>
    );
  }
}

HeaderDropdownMenu.propTypes = {
  onRenameGroupToggle: PropTypes.func.isRequired,
  onManageMembersToggle: PropTypes.func.isRequired,
  onDtableManageMembers: PropTypes.func.isRequired,
  onDeleteGroupToggle: PropTypes.func,
  onLeaveGroupToggle: PropTypes.func,
  onTransferGroupToggle: PropTypes.func,
  isOwner: PropTypes.bool,
  workspace: PropTypes.object,
  toggleGroupInviteDialog: PropTypes.func.isRequired,
  toggleGroupTrashDialog: PropTypes.func.isRequired,
  openGroupMember: PropTypes.func.isRequired,
  isOwnerOrAdmin: PropTypes.bool,
  isDepart: PropTypes.bool,
};

export default HeaderDropdownMenu;
