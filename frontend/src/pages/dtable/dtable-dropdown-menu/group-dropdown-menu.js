import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { enableAddressBookV2 } from '../../../constants/config';

const gettext = window.gettext;
const { isOrgContext } = window.app.pageOptions;
const propTypes = {
  onRenameDtableGroup: PropTypes.func.isRequired,
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

class GroupDropdownMenu extends React.Component {

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

  onRenameTableToggle = () => {
    this.props.onRenameDtableGroup();
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
    const { isOwner, isOwnerOrAdmin, workspace, isDepart } = this.props;
    const isDepartV2Group = enableAddressBookV2 && workspace.department_id;
    return (
      <Dropdown isOpen={this.state.dropdownOpen} toggle={this.dropdownToggle} direction="down" className="table-item-more-operation">
        <DropdownToggle
          tag='i'
          role="button"
          className='dtable-font dtable-icon-down3 cursor-pointer mx-2'
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.dropdownOpen}
          style={{ paddingRight: 8 }}
          aria-haspopup={true}
          tabIndex={0}
        >
        </DropdownToggle>
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu drop-list">
          <Fragment>
            {isOwner &&
              <DropdownItem onClick={this.onRenameTableToggle}>{gettext('Rename')}</DropdownItem>
            }
            {(!isDepart || isDepartV2Group) &&
              <DropdownItem onClick={this.props.openGroupMember}>{gettext('Group members')}</DropdownItem>
            }
            {!isDepart && isOwnerOrAdmin && !isDepartV2Group &&
              <DropdownItem onClick={this.onManageMembersToggle}>{gettext('Manage members')}</DropdownItem>
            }
            {!isOrgContext && isOwnerOrAdmin && !isDepartV2Group &&
              <DropdownItem onClick={this.openInviteDialog}>{gettext('Invite members')}</DropdownItem>
            }
            {isOwner &&
              <DropdownItem onClick={this.onTransferGroupToggle}>{gettext('Transfer')}</DropdownItem>
            }
            {isOwner &&
              <DropdownItem onClick={this.onDeleteGroupToggle.bind(workspace)}>{gettext('Delete group')}</DropdownItem>
            }
            {!isDepart && !isOwner && !isDepartV2Group &&
              <DropdownItem onClick={this.onLeaveGroupToggle.bind(workspace)}>{gettext('Leave group')}</DropdownItem>
            }
            {isOwnerOrAdmin &&
              <DropdownItem onClick={this.openTrashDialog}>{gettext('Trash')}</DropdownItem>
            }
          </Fragment>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

GroupDropdownMenu.propTypes = propTypes;

export default GroupDropdownMenu;
