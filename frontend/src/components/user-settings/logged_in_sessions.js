import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import toaster from '../toaster';
import { seaQAAPI } from '../../api/web-api';
import { loginUrl, gettext, mediaUrl } from '../../constants';
import { Utils } from '../../utils/utils';
import ModalPortal from '../modal-portal';
import Loading from '../loading';
import LogOutSessionDialog from '../dialog/log-out-session-dialog';
import OpMenu from '../dialog/op-menu';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  logOutSession: PropTypes.func.isRequired,
  deleteSession: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isLogOutDialogOpen: false
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false });
    }
  };

  onUnfreezedItem = () => {
    this.setState({ isOpIconShown: false });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Log out':
        this.toggleLogOutDialog();
        break;
      case 'Delete':
        this.onDeleteSession();
        break;
      default:
        break;
    }
  };

  translateOperations = (item) => {
    let translateResult = '';
    switch (item) {
      case 'Log out':
        translateResult = gettext('Log out');
        break;
      case 'Delete':
        translateResult = gettext('Delete');
        break;
      default:
        break;
    }

    return translateResult;
  };

  onLogOutSession = () => {
    const item = this.props.item;
    const { session_id, user_name } = item;
    seaQAAPI.logOutSession(session_id).then(() => {
      this.props.logOutSession(item);
      const msg = gettext('Successfully log out {name}.').replace('{name}', user_name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
    this.toggleLogOutDialog();
  };

  onDeleteSession = () => {
    const item = this.props.item;
    const { session_id } = item;
    seaQAAPI.deleteSession(session_id).then(() => {
      this.props.deleteSession(item);
      const msg = gettext('Deleted 1 item.');
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleLogOutDialog = () => {
    this.setState({ isLogOutDialogOpen: !this.state.isLogOutDialogOpen });
  };

  getBrowserIcon = (browserInfo) => {
    let type = '';
    if (browserInfo.includes('chrome')) {
      type = 'chrome';
    } else if (browserInfo.includes('firefox')) {
      type = 'firefox';
    } else if (browserInfo.includes('safari')) {
      type = 'safari';
    } else if (browserInfo.includes('opera')) {
      type = 'opera';
    } else if (browserInfo.includes('edge') || browserInfo.includes('ie')) {
      type = 'edge';
    }
    if (type) {
      return <img src={`${mediaUrl}img/browser/${type}.png`} width="24" height='24' alt={type} />;
    }
    return null;
  };

  render() {
    const item = this.props.item;
    const { is_online, remote_address, user_agent, op_time, is_self } = item;
    const { os_info, browser_info } = user_agent;
    return (
      <Fragment>
        <tr
          onMouseEnter={this.handleMouseOver}
          onMouseLeave={this.handleMouseOut}
        >
          <td>{is_online && <div className="logged-state"></div>}</td>
          <td>{this.getBrowserIcon(browser_info.toLowerCase())}</td>
          <td>{browser_info}</td>
          <td>{os_info}</td>
          <td>{remote_address}</td>
          <td title={op_time ? formatWithTimezone(op_time) : ''}>{op_time ? dayjs(op_time).format('YYYY-MM-DD HH:mm:ss') : '--'}</td>
          <td align={'center'}>
            {this.state.isOpIconShown && is_online && !is_self &&
              <OpMenu
                operations={['Log out']}
                translateOperations={this.translateOperations}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
            {is_self && gettext('current browser')}
            {this.state.isOpIconShown && !is_online &&
              <OpMenu
                operations={['Delete']}
                translateOperations={this.translateOperations}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isLogOutDialogOpen &&
          <ModalPortal>
            <LogOutSessionDialog
              currentSession={item}
              onLogOutSession={this.onLogOutSession}
              logOutCancel={this.toggleLogOutDialog}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  listSessions: PropTypes.func.isRequired,
  logOutSession: PropTypes.func.isRequired,
  deleteSession: PropTypes.func.isRequired,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
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
    }
    if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    }
    if (items && items.length === 0) {
      return <p>{gettext('No session logs')}</p>;
    }
    return (
      <table className="logged-in-session-table">
        <thead>
          <tr>
            <th width="3%">{/* Log state*/}</th>
            <th width="5%">{/* Browser icon*/}</th>
            <th width="30%">{/* Browser name*/}</th>
            <th width="20%">{/* OS*/}</th>
            <th width="15%">{/* Remote address*/}</th>
            <th width="15%">{/* Operate time*/}</th>
            <th width="12%">{/* Operations*/}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            return (
              <Item
                key={index}
                item={item}
                isItemFreezed={this.state.isItemFreezed}
                onFreezedItem={this.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
                logOutSession={this.props.logOutSession}
                deleteSession={this.props.deleteSession}
              />
            );
          })}
        </tbody>
      </table>
    );
  }
}

Content.propTypes = contentPropTypes;

const LoggedInSessionsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class LoggedInSessions extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      sessions: [],
    };
  }

  componentDidMount() {
    this.listSessions();
  }

  listSessions = () => {
    seaQAAPI.listSessions().then((res) => {
      this.setState({
        loading: false,
        sessions: res.data.sessions,
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

  logOutSession = (logSession) => {
    let sessions = this.state.sessions.filter(session => {
      return session.session_id !== logSession.session_id;
    });
    this.setState({ sessions: sessions });
  };

  deleteSession = (deletedSession) => {
    let sessions = this.state.sessions.filter(session => {
      return session.session_id !== deletedSession.session_id;
    });
    this.setState({ sessions: sessions });
  };

  render() {
    return (
      <Content
        loading={this.state.loading}
        errorMsg={this.state.errorMsg}
        items={this.state.sessions}
        listSessions={this.listSessions}
        logOutSession={this.logOutSession}
        deleteSession={this.deleteSession}
      />
    );
  }
}

LoggedInSessions.propTypes = LoggedInSessionsPropTypes;

export default LoggedInSessions;
