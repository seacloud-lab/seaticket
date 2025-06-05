import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import NotificationNav from './notifications-nav';
import '../../../css/system-dtable.css';
import Paginator from '../../../components/paginator';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  deleteNotification: PropTypes.func.isRequired,
  curPerPage: PropTypes.number,
  listSysUserNotificationsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
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

  getPreviousPageList = () => {
    this.props.listSysUserNotificationsByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listSysUserNotificationsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No notifications')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="20%">{gettext('User')}</th>
                <th width="50%">{gettext('Notification detail')}</th>
                <th width="20%">{gettext('Created at')}</th>
                <th width="5%">{gettext('Read by user')}</th>
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
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={this.props.currentPage}
            hasNextPage={this.props.hasNextPage}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
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
  deleteNotification: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false
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

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      default:
        break;
    }
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen } = this.state;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}>
          <td>
            {item.name}
            {item.contact_email &&
            <Fragment>
              <br/>
              {item.contact_email}
            </Fragment>
            }
            {item.org_name &&
            <Fragment>
              <br/>
              ({item.org_name})
            </Fragment>
            }
          </td>
          <td>
            {item.msg}
          </td>
          <td>
            {`${item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm') : '--'}`}
          </td>
          <td style={{ textAlign: 'center' }}>
            {item.seen &&
            <span className="dtable-font dtable-icon-check-circle"></span>
            }
          </td>
          <td>
            {isOpIconShown &&
            <OpMenu
              item={item}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
              setToCurrent={false}
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
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const userNotificationsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class UserNotifications extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      notificationList: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listSysUserNotificationsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listSysUserNotificationsByPage(1);
    });
  };

  listSysUserNotificationsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListAllSysUserNotifications(page, perPage).then((res) => {
      this.setState({
        loading: false,
        notificationList: res.data.notifications,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.total_count),
        currentPage: page
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

  deleteNotification = (id) => {
    sysAdminServiceApi.sysAdminDeleteSysUserNotification(id).then(res => {
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

  render() {
    return (
      <Fragment>
        <MainPanelTopbar/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <NotificationNav currentItem='user-notifications'/>
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.notificationList}
                deleteNotification={this.deleteNotification}
                listSysUserNotificationsByPage={this.listSysUserNotificationsByPage}
                curPerPage={this.state.perPage}
                resetPerPage={this.resetPerPage}
                currentPage={this.state.currentPage}
                hasNextPage={this.state.hasNextPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

UserNotifications.propTypes = userNotificationsPropTypes;

export default UserNotifications;
