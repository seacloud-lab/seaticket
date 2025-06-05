import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import SysAdminAddSysNotificationDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-add-sys-notification-dialog';
import SysAdminUpdateSysNotificationDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-update-sys-notification-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import NotificationNav from './notifications-nav';

import '../../../css/system-dtable.css';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  deleteNotification: PropTypes.func.isRequired,
  setToCurrent: PropTypes.func.isRequired,
  updateNotification: PropTypes.func.isRequired,
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
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No notifications')} />
      );
      const table = (
        <table>
          <thead>
            <tr>
              <th width="95%">{gettext('Notification detail')}</th>
              <th width="5%">{/* Operations*/}</th>
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
                deleteNotification={this.props.deleteNotification}
                setToCurrent={this.props.setToCurrent}
                updateNotification={this.props.updateNotification}
              />);
            })}
          </tbody>
        </table>
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
  deleteNotification: PropTypes.func.isRequired,
  setToCurrent: PropTypes.func.isRequired,
  updateNotification: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isModifyNotificationDialogOpen: false
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

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  deleteNotification = () => {
    this.props.deleteNotification(this.props.item.id);
    this.toggleDeleteDialog();
  };

  setToCurrent = () => {
    this.props.setToCurrent(this.props.item.id, !this.props.item.is_current);
  };

  toggleModifyNotificationDialog = () => {
    this.setState({ isModifyNotificationDialogOpen: !this.state.isModifyNotificationDialogOpen });
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Enable':
        this.setToCurrent();
        break;
      case 'Disable':
        this.setToCurrent();
        break;
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      default:
        break;
    }
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen, isModifyNotificationDialogOpen } = this.state;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td onClick={this.toggleModifyNotificationDialog}>
            {item.msg}
            {item.is_current &&
              <span className="small text-orange">{gettext('(current notification)')}</span>
            }
          </td>
          <td>
            {isOpIconShown &&
            <OpMenu
              item={item}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
              setToCurrent={true}
            />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete notification')}
            message={gettext('Are you sure you want to delete the notification ?')}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.deleteNotification}
            confirmBtnText={gettext('Delete')}
          />
        }
        {isModifyNotificationDialogOpen &&
          <SysAdminUpdateSysNotificationDialog
            item={item}
            updateNotification={this.props.updateNotification}
            toggle={this.toggleModifyNotificationDialog}
            msg={item.msg}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const notificationsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class Notifications extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      notificationList: [],
      isAddNotificationDialogOpen: false
    };
  }

  componentDidMount() {
    sysAdminServiceApi.sysAdminListAllSysNotifications().then((res) => {
      this.setState({
        loading: false,
        notificationList: res.data.notifications
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

  toggleAddNotificationDialog = () => {
    this.setState({ isAddNotificationDialogOpen: !this.state.isAddNotificationDialogOpen });
  };

  addNotification = (msg) => {
    sysAdminServiceApi.sysAdminAddSysNotification(msg).then(res => {
      let notificationList = this.state.notificationList;
      notificationList.unshift(res.data.notification);
      this.setState({ notificationList: notificationList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  updateNotification = (id, msg) => {
    sysAdminServiceApi.sysAdminUpdateSysNotification(id, msg, '').then(res => {
      let notificationList = this.state.notificationList.map(item => {
        if (item.id === id) {
          item.msg = msg;
        }
        return item;
      });
      this.setState({ notificationList: notificationList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteNotification = (id) => {
    sysAdminServiceApi.sysAdminDeleteSysNotification(id).then(res => {
      let notificationList = this.state.notificationList.filter(item => {
        return item.id !== id;
      });
      this.setState({ notificationList: notificationList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  setToCurrent = (id, primary) => {
    primary = String(primary);
    sysAdminServiceApi.sysAdminUpdateSysNotification(id, '', primary).then(res => {
      let oldInfoID = localStorage.getItem('info_id');
      if (!oldInfoID) {
        oldInfoID = '';
      }
      let oldInfoIdList = oldInfoID.split('_');
      let notificationList = this.state.notificationList.map(item => {
        if (item.id === id) {
          if (!item.is_current){
            let idIndex = oldInfoIdList.indexOf(item.id.toString());
            if (idIndex !== -1) {
              oldInfoIdList = oldInfoIdList.filter(old_id => {
                return old_id !== item.id.toString();
              });
            }
          }
          item.is_current = !item.is_current;
        }
        return item;
      });
      localStorage.setItem('info_id', oldInfoIdList.join('_'));
      this.setState({ notificationList: notificationList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { isAddNotificationDialogOpen } = this.state;
    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    if (isDesktop) {
      MainPanelTopbarContainer = (
        <MainPanelTopbar>
          <Button className="btn btn-secondary operation-item" onClick={this.toggleAddNotificationDialog}>{gettext('Add notification')}</Button>
        </MainPanelTopbar>
      );
    } else {
      MainPanelTopbarContainer = (
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleAddNotificationDialog}>{gettext('Add notification')}</span>
        </MainPanelTopbar>
      );
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <NotificationNav currentItem='notifications'/>
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.notificationList}
                deleteNotification={this.deleteNotification}
                setToCurrent={this.setToCurrent}
                updateNotification={this.updateNotification}
              />
            </div>
          </div>
        </div>
        {isAddNotificationDialogOpen &&
          <SysAdminAddSysNotificationDialog
            addNotification={this.addNotification}
            toggle={this.toggleAddNotificationDialog}
          />
        }
      </Fragment>
    );
  }
}

Notifications.propTypes = notificationsPropTypes;

export default Notifications;
