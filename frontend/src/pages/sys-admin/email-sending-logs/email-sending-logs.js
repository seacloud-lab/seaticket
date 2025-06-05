import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { gettext, loginUrl, mediaUrl } from '../../../utils/constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import MainPanelTopbar from '../main-panel-topbar';
import '../../../css/system-dtable.css';
import Paginator from '../../../components/paginator';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  curPerPage: PropTypes.number,
  listEmailSendingLogsByPage: PropTypes.func.isRequired,
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
    this.props.listEmailSendingLogsByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listEmailSendingLogsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading/>;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <Fragment>
          <p className="mt-4 seatable-tip-default">{gettext('Tip: Emails sent via thirdparty email accounts are listed here.')}</p>
          <DTableEmptyTip text={gettext('No sending logs')} src={`${mediaUrl}img/no-items-tip.png`} />
        </Fragment>
      );
      const table = (
        <Fragment>
          <p className="mt-4 seatable-tip-default">{gettext('Tip: Emails sent via thirdparty email accounts are listed here.')}</p>
          <table>
            <thead>
              <tr>
                <th width="25%">{gettext('User')}</th>
                <th width="35%">{gettext('Email host')}</th>
                <th width="30%">{gettext('Created at')}</th>
                <th width="10%">{gettext('Success')}</th>
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
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
    });
    this.props.onUnfreezedItem();
  };

  render() {
    const { item } = this.props;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}>
          <td>
            {item.name}
          </td>
          <td>
            {item.host}
          </td>
          <td>
            {`${item.create_time ? dayjs(item.create_time).format('YYYY-MM-DD HH:mm') : '--'}`}
          </td>
          <td>
            {item.success &&
            <span className="dtable-font dtable-icon-check-circle"></span>
            }
          </td>

        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const emailSendingLogsPropTypes = {
  onCloseSidePanel: PropTypes.func
};

class EmailSendingLogs extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      emailSendingLogs: [],
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
      this.listEmailSendingLogsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listEmailSendingLogsByPage(1);
    });
  };

  listEmailSendingLogsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListEmailSendingLogs(page, perPage).then((res) => {
      this.setState({
        loading: false,
        emailSendingLogs: res.data.email_sending_logs,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.count),
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

  render() {
    return (
      <Fragment>
        <MainPanelTopbar/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Email sending logs')}</h2>
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.emailSendingLogs}
                listEmailSendingLogsByPage={this.listEmailSendingLogsByPage}
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

EmailSendingLogs.propTypes = emailSendingLogsPropTypes;

export default EmailSendingLogs;
