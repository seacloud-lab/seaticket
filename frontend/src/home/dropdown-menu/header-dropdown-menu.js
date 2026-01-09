import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle } from 'reactstrap';
import { canAddProject, disableAddingPersonalProjects } from '../../constants';
import { Icon, CustomizeDropdownMenu, CustomizeDropdownItem } from '../../components';

import './header-dropdown-menu.css';

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
          title={gettext('More operations')}aria-label={gettext('More operations')}data-toggle="dropdown"
          aria-expanded={this.state.dropdownOpen}aria-haspopup={true}tabIndex={0}
        >
          <Icon symbol="plus" />
          <Icon symbol="arrow-down" />
        </DropdownToggle>
        <CustomizeDropdownMenu className="drop-list">
          {showAddProject && (
            <CustomizeDropdownItem onClick={this.props.showVirtualProject}>
              <CustomizeDropdownItem.Icon symbol="plus" />
              <CustomizeDropdownItem.Text>{gettext('Add a blank project')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwner && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.onRenameToggle}>
              <CustomizeDropdownItem.Icon symbol="rename" />
              <CustomizeDropdownItem.Text>{gettext('Rename')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {showGroupOptions && (
            <CustomizeDropdownItem onClick={this.props.openGroupMember}>
              <CustomizeDropdownItem.Icon symbol="group-members" />
              <CustomizeDropdownItem.Text>{gettext('Group members')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwnerOrAdmin && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.openInviteDialog}>
              <CustomizeDropdownItem.Icon symbol="invite-members" />
              <CustomizeDropdownItem.Text>{gettext('Invite members')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwnerOrAdmin && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.onManageMembersToggle}>
              <CustomizeDropdownItem.Icon symbol="manage-members" />
              <CustomizeDropdownItem.Text>{gettext('Manage members')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwner && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.onTransferGroupToggle}>
              <CustomizeDropdownItem.Icon symbol="transfer" />
              <CustomizeDropdownItem.Text>{gettext('Transfer')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwner && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.onDeleteGroupToggle.bind(workspace)}>
              <CustomizeDropdownItem.Icon symbol="delete" />
              <CustomizeDropdownItem.Text>{gettext('Delete group')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {!isOwner && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.onLeaveGroupToggle.bind(workspace)}>
              <CustomizeDropdownItem.Icon symbol="leave-group" />
              <CustomizeDropdownItem.Text>{gettext('Leave group')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          )}
          {isOwnerOrAdmin && showGroupOptions && (
            <CustomizeDropdownItem onClick={this.openTrashDialog}>
              <CustomizeDropdownItem.Icon symbol="trash" />
              <CustomizeDropdownItem.Text>{gettext('Trash')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
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
