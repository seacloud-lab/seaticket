import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { CustomizeDropdownMoreToggle, toaster, Paginator } from '../../components';
import { siteRoot, gettext, orgID } from '../../constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import OrgGroupInfo from '../../models/org-group';
import MainPanelTopbar from './main-panel-topbar';
import DeleteConfirmDialog from '../../components/dialog/orgadmin-dialog/delete-item-confirm-dialog';
import OrgAdminTransferGroupDialog from '../../components/dialog/orgadmin-dialog/orgadmin-group-transfer-dialog';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgGroups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      page: 1,
      pageNext: false,
      perPage: 25,
      orgGroups: [],
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    const { page, perPage } = this.state;
    this.initData(page, perPage);
  }

  initData = (page, perPage) => {
    orgAdminServiceApi.orgAdminListOrgGroups(orgID, page, perPage).then(res => {
      let orgGroups = res.data.groups.map(item => {
        return new OrgGroupInfo(item);
      });
      this.setState({
        orgGroups: orgGroups,
        pageNext: res.data.page_next,
        page: res.data.page,
        perPage: res.data.per_page,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };


  onChangePageNum = (num) => {
    const { page: oldPage, perPage } = this.state;
    let newPage;
    if (num === 1) {
      newPage = oldPage + 1;
    } else {
      newPage = oldPage - 1;
    }
    this.setState({ page: newPage }, () => {
      this.initData(newPage, perPage);
    });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  deleteGroupItem = (group) => {
    orgAdminServiceApi.orgAdminDeleteOrgGroup(orgID, group.id).then(res => {
      this.setState({
        orgGroups: this.state.orgGroups.filter(item => item.id !== group.id)
      });
      let msg = gettext('Successfully deleted {name}');
      msg = msg.replace('{name}', group.groupName);
      toaster.success(msg);
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      if (error.response && error.response.data && error.response.data['error_msg']) {
        errMessage = error.response.data['error_msg'];
      }
      toaster.danger(errMessage);
    });
  };

  transferGroup = (groupID, receiverEmail) => {
    orgAdminServiceApi.orgAdminTransferOrgGroup(orgID, receiverEmail, groupID).then(res => {
      let newGroupList = this.state.orgGroups.map(item => {
        if (item.id === groupID) {
          item = new OrgGroupInfo(res.data);
        }
        return item;
      });
      this.setState({
        orgGroups: newGroupList
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  changePerPage = (newPerPage) => {
    const { perPage } = this.state;
    if (perPage === newPerPage) return;
    const newPage = 1;
    this.setState({
      perPage: newPerPage,
      page: newPage,
    }, () => {
      this.initData(newPage, newPerPage);
    });
  };

  render() {
    let groups = this.state.orgGroups;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('All groups')}</h2>
            <div className="cur-view-content">
              <table>
                <thead>
                  <tr>
                    <th width="20%">{gettext('Name')}</th>
                    <th width="30%">{gettext('Owner')}</th>
                    <th width="20%">{gettext('Size')}</th>
                    <th width="20%">{gettext('Created at')}</th>
                    <th width="10%" className="text-center">{gettext('Operations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(item => {
                    return (
                      <GroupItem
                        key={item.id}
                        group={item}
                        isItemFreezed={this.state.isItemFreezed}
                        onFreezedItem={this.onFreezedItem}
                        onUnfreezedItem={this.onUnfreezedItem}
                        deleteGroupItem={this.deleteGroupItem}
                        transferGroup={this.transferGroup}
                      />
                    );
                  })}
                </tbody>
              </table>
              <Paginator
                curPerPage={this.state.perPage}
                currentPage={this.state.page}
                hasNextPage={this.state.pageNext}
                goNextPage={() => this.onChangePageNum(1)}
                goPreviousPage={() => this.onChangePageNum(-1)}
                resetPerPage={this.changePerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgGroups.propTypes = propTypes;

const GroupItemPropTypes = {
  group: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteGroupItem: PropTypes.func.isRequired,
  transferGroup: PropTypes.func.isRequired,
};

class GroupItem extends React.Component {

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

  toggleDelete = () => {
    this.props.deleteGroupItem(this.props.group);
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogShow: !this.state.isDeleteDialogShow });
  };

  toggleTransferDialog = () => {
    this.setState({ isTransferDialogShow: !this.state.isTransferDialogShow });
  };

  renderGroupHref = (group) => {
    let groupInfoHref;
    if (group.creatorName === 'system admin' && !group.departmentId) {
      groupInfoHref = siteRoot + 'org/departmentadmin/groups/' + group.id + '/';
    } else {
      groupInfoHref = siteRoot + 'org/groupadmin/' + group.id + '/';
    }

    return groupInfoHref;
  };

  renderGroupCreator = (group) => {
    let userInfoHref = siteRoot + 'org/useradmin/info/' + group.creatorEmail + '/';
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
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                  <DropdownItem onClick={this.toggleTransferDialog}>{gettext('Transfer')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          </td>
        </tr>
        {this.state.isDeleteDialogShow && (
          <DeleteConfirmDialog
            headerText={gettext('Delete group')}
            toggle={this.toggleDeleteDialog}
            onDelete={this.toggleDelete}
            itemName={group.groupName}
            isOpen={this.state.isDeleteDialogShow}
          />
        )}
        {this.state.isTransferDialogShow &&
          <OrgAdminTransferGroupDialog
            groupName={group.groupName}
            transferGroup={this.transferGroup}
            toggleDialog={this.toggleTransferDialog}
          />
        }
      </Fragment>
    );
  }
}

GroupItem.propTypes = GroupItemPropTypes;

export default OrgGroups;
