import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { gettext, mediaUrl } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import dayjs from '../../../utils/dayjs';
import LogsNav from './logs-nav';
import Loading from '../../../components/loading';
import { DTableEmptyTip } from 'dtable-ui-component';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import UserLink from '../user-link';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

function Item(props) {
  const item = props.item;
  return (
    <tr>
      <td><UserLink email={item.email} name={item.name}/></td>
      <td>{item.login_ip}</td>
      <td>{item.log_success ? gettext('Success') : gettext('Failed')}</td>
      <td>{dayjs(item.login_time).fromNow()}</td>
    </tr>
  );
}

Item.propTypes = {
  item: PropTypes.object.isRequired
};


class Content extends Component {

  static propTypes = {
    loading: PropTypes.bool.isRequired,
    errorMsg: PropTypes.string,
    items: PropTypes.array,
    currentPage: PropTypes.number.isRequired,
    perPage: PropTypes.number.isRequired,
    hasNextPage: PropTypes.bool.isRequired,
    getLogsByPage: PropTypes.func.isRequired,
    resetPerPage: PropTypes.func.isRequired,
  };

  getPreviousPage = () => {
    this.props.getLogsByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getLogsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, perPage, currentPage, hasNextPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No login logs')} />
      );
      const table = (
        <>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="25%">{gettext('Name')}</th>
                <th width="25%">{gettext('IP')}</th>
                <th width="25%">{gettext('Status')}</th>
                <th width="25%">{gettext('Time')}</th>
              </tr>
            </thead>
            {items &&
              <tbody>
                {items.map((item, index) => <Item key={index} item={item}/>)}
              </tbody>
            }
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            curPerPage={perPage}
            resetPerPage={this.props.resetPerPage}
          />
        </>
      );
      return items.length ? table : emptyTip;
    }
  }
}

export default class LoginLogs extends Component {

  static propTypes = {
    onCloseSidePanel: PropTypes.func
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      logList: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false,
    };
    this.initPage = 1;
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.getLogsByPage(this.state.currentPage);
    });
  }

  getLogsByPage = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListLoginLogs(page, perPage).then((res) => {
      this.setState({
        logList: res.data.login_log_list,
        loading: false,
        currentPage: page,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.total_count),
      });
    }).catch((error) => {
      this.setState({
        loading: false,
        errorMsg: Utils.getErrorMsg(error, true) // true: show login tip if 403
      });
    });
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
    }, () => this.getLogsByPage(this.initPage));
  };

  render() {
    let { logList, currentPage, perPage, hasNextPage } = this.state;

    return (
      <>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <LogsNav currentItem="loginLogs" />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={logList}
                currentPage={currentPage}
                perPage={perPage}
                hasNextPage={hasNextPage}
                getLogsByPage={this.getLogsByPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </>
    );
  }
}
