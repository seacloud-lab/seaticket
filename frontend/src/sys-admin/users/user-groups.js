import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import dayjs from 'dayjs';
import { toaster, EmptyTip } from '@/components';
import { Utils } from '@/utils/utils';
import { siteRoot, loginUrl, gettext, mediaUrl } from '@/constants';
import Loading from '@/components/loading';
import CommonOperationConfirmationDialog from '@/components/dialog/common-operation-confirmation-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import Nav from './user-nav';
import OpMenu from './user-op-menu';
import AddUserToGroupsOperation from './common-operations/add-user-to-groups';
import sysAdminAPI from '@/sys-admin/api';

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  deleteItem: PropTypes.func.isRequired,
  removeFromGroup: PropTypes.func,
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

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No groups')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="35%">{gettext('Name')}</th>
                <th width="30%">{gettext('Role')}</th>
                <th width="30%">{gettext('Created at')}</th>
                <th width="5%">{/* Operations */}</th>
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
                  deleteItem={this.props.deleteItem}
                  removeFromGroup={this.props.removeFromGroup}
                />);
              })}
            </tbody>
          </table>
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteItem: PropTypes.func.isRequired,
  removeFromGroup: PropTypes.func
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isRemoveFromGroupDialogOpen: false
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

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleRemoveFromGroupDialog = () => {
    this.setState({ isRemoveFromGroupDialogOpen: !this.state.isRemoveFromGroupDialogOpen });
  };

  deleteItem = () => {
    this.props.deleteItem(this.props.item.id);
  };

  removeFromGroup = () => {
    this.props.removeFromGroup(this.props.item.id);
  };

  translateOperations = (item) => {
    let translateResult = '';
    switch (item) {
      case 'Delete':
        translateResult = gettext('Delete');
        break;
      case 'Remove':
        translateResult = gettext('Remove from group');
        break;
      default:
        break;
    }

    return translateResult;
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'Remove':
        this.toggleRemoveFromGroupDialog();
        break;
      default:
        break;
    }
  };

  getRoleText = () => {
    let roleText;
    const { item } = this.props;
    switch (item.role) {
      case 'Owner':
        roleText = gettext('Owner');
        break;
      case 'Admin':
        roleText = gettext('Admin');
        break;
      case 'Member':
        roleText = gettext('Member');
        break;
      default:
        break;
    }
    return roleText;
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen, isRemoveFromGroupDialogOpen } = this.state;

    const itemName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    const deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', itemName);
    const removeFromGroupDialogMsg = gettext('Are you sure you want to remove from {placeholder} ?').replace('{placeholder}', itemName);

    const url = `${siteRoot}sys/groups/${item.id}/members/`;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td><Link to={url}>{item.name}</Link></td>
          <td>{this.getRoleText()}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</td>
          <td>
            {(isOpIconShown && item.parent_group_id === 0) &&
              <OpMenu
                operations={['Remove']}
                translateOperations={this.translateOperations}
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
            executeOperation={this.deleteItem}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
        {isRemoveFromGroupDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Remove from group')}
            message={removeFromGroupDialogMsg}
            executeOperation={this.removeFromGroup}
            confirmBtnText={gettext('Remove')}
            toggleDialog={this.toggleRemoveFromGroupDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const groupPropTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class Groups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      userInfo: {},
      items: []
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    sysAdminAPI.sysAdminGetUser(email).then((res) => {
      this.setState({
        userInfo: res.data
      });
    });
    sysAdminAPI.sysAdminListGroupsJoinedByUser(email).then(res => {
      this.setState({
        loading: false,
        items: res.data.group_list
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
  }

  deleteItem = (groupID) => {
    sysAdminAPI.sysAdminDismissGroupByID(groupID).then(res => {
      let items = this.state.items.filter(item => {
        return item.id !== groupID;
      });
      this.setState({ items: items });
      toaster.success(gettext('Deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  removeFromGroup = (groupID) => {
    const email = decodeURIComponent(this.props.email);
    sysAdminAPI.sysAdminDeleteGroupMember(groupID, email).then(res => {
      let items = this.state.items.filter(item => {
        return item.id !== groupID;
      });
      this.setState({ items: items });
      toaster.success(gettext('Successfully remove from 1 item.'));
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  addToGroups = (groups) => {
    const newItems = this.state.items.slice();
    groups.forEach(group => {
      const isExist = this.state.items.find(item => item.id === group.group_id);
      if (isExist) return;
      newItems.push(group);
    });
    this.setState({ items: newItems });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <AddUserToGroupsOperation
            title={gettext('Add to groups')}
            email={decodeURIComponent(this.props.email)}
            groupList={this.state.items}
            addToGroups={this.addToGroups}
          />
        </MainPanelTopbar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <Nav currentItem="groups" email={this.props.email} userName={this.state.userInfo.name} />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.items}
                deleteItem={this.deleteItem}
                removeFromGroup={this.removeFromGroup}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

Groups.propTypes = groupPropTypes;

export default Groups;
