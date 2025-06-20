import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import dayjs from '../../../utils/dayjs';
import { Utils } from '../../../utils/utils';
import { siteRoot, loginUrl, gettext, mediaUrl } from '../../../constants';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import SysAdminCreateGroupDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-create-group-dialog';
import SysAdminTransferGroupDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-group-transfer-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import Search from '../search';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  pageInfo: PropTypes.object,
  deleteGroup: PropTypes.func.isRequired,
  transferGroup: PropTypes.func.isRequired,
  getListByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  perPage: PropTypes.number
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPage = () => {
    this.props.getListByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No groups')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="20%">{gettext('Name')}</th>
                <th width="35%">{gettext('Owner')}</th>
                <th width="20%">{gettext('Size')}</th>
                <th width="20%">{gettext('Created at')}</th>
                <th width="5%">{/* operation */}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  deleteGroup={this.props.deleteGroup}
                  transferGroup={this.props.transferGroup}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
            resetPerPage={this.props.resetPerPage}
            curPerPage={this.props.perPage}
          />
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteGroup: PropTypes.func.isRequired,
  transferGroup: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isTransferDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShow: false
    });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'Transfer':
        this.toggleTransferDialog();
        break;
      default:
        break;
    }
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleTransferDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isTransferDialogOpen: !this.state.isTransferDialogOpen });
  };

  deleteGroup = () => {
    this.props.deleteGroup(this.props.item.id);
  };

  transferGroup = (receiver) => {
    this.props.transferGroup(this.props.item.id, receiver);
  };

  render() {
    const { isOpIconShown, isDeleteDialogOpen, isTransferDialogOpen } = this.state;
    const { item } = this.props;

    let groupName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    let deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', groupName);

    const groupUrl = `${siteRoot}sys/groups/${item.id}/dtables/`;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>
            <Link to={groupUrl}>{item.name}</Link>
            <Fragment>
              {item.org_id && item.org_id !== -1 &&
                <Fragment>
                  <br />
                  <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>({item.org_name})</Link>
                </Fragment>
              }
            </Fragment>
          </td>
          <td>
            {item.owner === 'system admin' ?
              '--' :
              <Link to={`${siteRoot}sys/users/${encodeURIComponent(item.owner)}/`}>{item.owner_name}</Link>
            }
          </td>
          <td>{`${Utils.bytesToSize(item.size)}`}</td>
          <td>
            <span title={dayjs(item.created_at).format('llll')}>{dayjs(item.created_at).fromNow()}</span>
          </td>
          <td>
            {(isOpIconShown && item.owner !== 'system admin') &&
            <OpMenu
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
            />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete group')}
            message={deleteDialogMsg}
            executeOperation={this.deleteGroup}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
        {isTransferDialogOpen &&
          <SysAdminTransferGroupDialog
            transferGroup={this.transferGroup}
            toggleDialog={this.toggleTransferDialog}
            item={item}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const groupsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class Groups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      groupList: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1,
      isCreateGroupDialogOpen: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.getGroupListByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.getGroupListByPage(1);
    });
  };

  toggleCreateGroupDialog = () => {
    this.setState({ isCreateGroupDialogOpen: !this.state.isCreateGroupDialogOpen });
  };

  getGroupListByPage = (page) => {
    sysAdminServiceApi.sysAdminListAllGroups(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        groupList: res.data.groups,
        pageInfo: res.data.page_info
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  };

  createGroup = (groupName, OnwerEmail) => {
    sysAdminServiceApi.sysAdminCreateNewGroup(groupName, OnwerEmail).then(res => {
      let newGroupList = this.state.groupList;
      newGroupList.unshift(res.data);
      this.setState({
        groupList: newGroupList
      });
      this.toggleCreateGroupDialog();
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteGroup = (groupID) => {
    sysAdminServiceApi.sysAdminDismissGroupByID(groupID).then(res => {
      let newGroupList = this.state.groupList.filter(item => {
        return item.id !== groupID;
      });
      this.setState({
        groupList: newGroupList
      });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  transferGroup = (groupID, receiverEmail) => {
    sysAdminServiceApi.sysAdminTransferGroup(receiverEmail, groupID).then(res => {
      let newGroupList = this.state.groupList.map(item => {
        if (item.id === groupID) {
          item = res.data;
        }
        return item;
      });
      this.setState({
        groupList: newGroupList
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search groups by name')}
      submit={this.searchGroups}
    />;
  };

  searchGroups = (name) => {
    navigate(`${siteRoot}sys/search-groups/?name=${encodeURIComponent(name)}`);
  };

  downloadGroupExcel = () => {
    let url = `${siteRoot}sys/groupadmin/export-excel/`;
    location.href = url;
  };

  render() {
    let { isCreateGroupDialogOpen } = this.state;

    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    if (isDesktop) {
      MainPanelTopbarContainer = (
        <MainPanelTopbar search={this.getSearch()}>
          <Button className="btn btn-secondary operation-item" onClick={this.toggleCreateGroupDialog}>{gettext('New group')}</Button>
          <a className="btn btn-secondary operation-item" href={`${siteRoot}sys/groupadmin/export-excel/`}>{gettext('Export Excel')}</a>
        </MainPanelTopbar>
      );
    } else {
      MainPanelTopbarContainer = (
        <MainPanelTopbar search={this.getSearch()} onCloseSidePanel={this.props.onCloseSidePanel}>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleCreateGroupDialog}>{gettext('New group')}</span>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.downloadGroupExcel}>{gettext('Export Excel')}</span>
        </MainPanelTopbar>
      );
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Groups')}</h2>
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.groupList}
                pageInfo={this.state.pageInfo}
                deleteGroup={this.deleteGroup}
                transferGroup={this.transferGroup}
                getListByPage={this.getGroupListByPage}
                resetPerPage={this.resetPerPage}
                perPage={this.state.perPage}
              />
            </div>
          </div>
        </div>
        {isCreateGroupDialogOpen &&
          <SysAdminCreateGroupDialog
            createGroup={this.createGroup}
            toggleDialog={this.toggleCreateGroupDialog}
          />
        }
      </Fragment>
    );
  }
}

Groups.propTypes = groupsPropTypes;

export default Groups;
