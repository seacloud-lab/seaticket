import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { canAddProject, disableAddingPersonalProjects } from '../../constants';
import './header-dropdown-menu.css';
import { Icon, CustomizeDropdownMenu, CustomizeDropdownItem } from '../../components';

const gettext = window.gettext;

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
    this.props.onProjectManageMembers();
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
    const { isOwner, isPersonal, isAdmin, isOwnerOrAdmin, workspace, showGroupOptions } = this.props;

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
          tag='div'
          role="button"
          className="cursor-pointer d-flex align-items-center"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.dropdownOpen}
          aria-haspopup={true}
          tabIndex={0}
        >
          <Icon symbol="add" />
          <Icon symbol="down" />
        </DropdownToggle>
        <CustomizeDropdownMenu className="drop-list">
          {showAddProject &&
            <CustomizeDropdownItem onClick={this.props.showVirtualProject}>{gettext('Add a blank project')}</CustomizeDropdownItem>
          }
          {isOwner && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.onRenameToggle}>{gettext('Rename')}</CustomizeDropdownItem>
          }
          {showGroupOptions &&
            <CustomizeDropdownItem onClick={this.props.openGroupMember}>{gettext('Group members')}</CustomizeDropdownItem>
          }
          {isOwnerOrAdmin && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.openInviteDialog}>{gettext('Invite members')}</CustomizeDropdownItem>
          }
          {isOwnerOrAdmin && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.onManageMembersToggle}>{gettext('Manage members')}</CustomizeDropdownItem>
          }
          {isOwner && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.onTransferGroupToggle}>{gettext('Transfer')}</CustomizeDropdownItem>
          }
          {isOwner && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.onDeleteGroupToggle.bind(workspace)}>{gettext('Delete group')}</CustomizeDropdownItem>
          }
          {!isOwner && showGroupOptions &&
            <CustomizeDropdownItem onClick={this.onLeaveGroupToggle.bind(workspace)}>{gettext('Leave group')}</CustomizeDropdownItem>
          }
          {isOwnerOrAdmin && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.openTrashDialog}>{gettext('Trash')}</CustomizeDropdownItem>
          )}
        </CustomizeDropdownMenu>
      </Dropdown>
    );
  }
}

HeaderDropdownMenu.propTypes = {
  onRenameGroupToggle: PropTypes.func.isRequired,
  onManageMembersToggle: PropTypes.func.isRequired,
  onProjectManageMembers: PropTypes.func.isRequired,
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
