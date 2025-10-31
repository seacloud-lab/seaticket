import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'reactstrap';
import { CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem } from '@/components';
import { siteRoot, gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { CommonOperationConfirmationDialog } from '@/components';
import TransferDialog from './transfer-dialog';

class Group extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      showMenu: false,
      isItemMenuShow: false,
      isDeleteDialogShow: false,
      isTransferDialogShow: false,
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: true,
        highlight: true,
      });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: false,
        highlight: false
      });
    }
  };

  onDropdownToggleClick = (e) => {
    e.preventDefault();
    this.toggleOperationMenu(e);
  };

  toggleOperationMenu = (e) => {
    e.stopPropagation();
    this.setState(
      { isItemMenuShow: !this.state.isItemMenuShow }, () => {
        if (this.state.isItemMenuShow) {
          this.props.onFreezedItem();
        } else {
          this.setState({
            highlight: false,
            showMenu: false,
          });
          this.props.onUnfreezedItem();
        }
      }
    );
  };

  handleDelete = () => {
    this.props.deleteGroupItem(this.props.group);
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogShow: !this.state.isDeleteDialogShow });
  };

  toggleTransferDialog = () => {
    this.setState({ isTransferDialogShow: !this.state.isTransferDialogShow });
  };

  renderGroupHref = (group) => {
    return siteRoot + 'org/groups/' + group.id + '/';
  };

  renderGroupCreator = (group) => {
    let userInfoHref = siteRoot + 'org/users/info/' + group.creatorEmail + '/';
    if (group.creatorName === 'system admin') {
      return (
        <td>{'--'}</td>
      );
    } else {
      return (
        <td>
          <a href={userInfoHref} className="font-weight-normal">{group.creatorName}</a>
        </td>
      );
    }
  };

  transferGroup = (receiver) => {
    let { group } = this.props;
    this.props.transferGroup(group.id, receiver);
  };

  render() {
    let { group } = this.props;
    let isOperationMenuShow = (group.creatorName !== 'system admin') && this.state.showMenu;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td>
            <a href={this.renderGroupHref(group)} className="font-weight-normal">{group.groupName}</a>
          </td>
          {this.renderGroupCreator(group)}
          <td>{`${Utils.bytesToSize(group.size)}`}</td>
          <td>{group.ctime}</td>
          <td className="text-center cursor-pointer">
            {isOperationMenuShow &&
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} onClick={this.onDropdownToggleClick}/>
                <CustomizeDropdownMenu>
                  <CustomizeDropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</CustomizeDropdownItem>
                  <CustomizeDropdownItem onClick={this.toggleTransferDialog}>{gettext('Transfer')}</CustomizeDropdownItem>
                </CustomizeDropdownMenu>
              </Dropdown>
            }
          </td>
        </tr>
        {this.state.isDeleteDialogShow && (
          <CommonOperationConfirmationDialog
            title={gettext('Delete group')}
            message={gettext('Are you sure you want to delete {group} ?').replace('{group}', `<b>${group.groupName}</b>`)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.handleDelete}
          />
        )}
        {this.state.isTransferDialogShow && (
          <TransferDialog
            groupName={group.groupName}
            transferGroup={this.transferGroup}
            toggleDialog={this.toggleTransferDialog}
          />
        )}
      </Fragment>
    );
  }
}

Group.propTypes = {
  group: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteGroupItem: PropTypes.func.isRequired,
  transferGroup: PropTypes.func.isRequired,
};

export default Group;
