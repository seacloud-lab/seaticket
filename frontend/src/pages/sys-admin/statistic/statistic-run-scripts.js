import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { DTableEmptyTip } from 'dtable-ui-component';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { Input } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl, siteRoot, mediaUrl } from '../../../utils/constants';
import Nav from './statistic-nav';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';


const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isUser: PropTypes.bool.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    this.setState({
      highlight: true
    });
  };

  handleMouseOut = () => {
    this.setState({
      highlight: false
    });
  };

  renderUser = (username, name) => {
    return <Link to={`${siteRoot}sys/users/${encodeURIComponent(username)}/`}>{name}</Link>;
  };

  renderOrg = (org_id, org_name) => {
    return <Link to={`${siteRoot}sys/organizations/${org_id}/info/`}>{org_name}</Link>;
  };

  render() {
    const { item, isUser } = this.props;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseOut}>
          <td>{isUser ? this.renderUser(item.username, item.name) : this.renderOrg(item.org_id, item.org_name)}</td>
          <td>{item.total_run_count}</td>
          <td>{item.total_run_time}</td>
        </tr>
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number,
  pageInfo: PropTypes.object.isRequired,
  getStatisticRunScriptsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  isUser: PropTypes.bool.isRequired,
  sortItems: PropTypes.func.isRequired,
  orderBy: PropTypes.string.isRequired,
};


class Content extends Component {

  getPreviousPageList = () => {
    this.props.getStatisticRunScriptsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.getStatisticRunScriptsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo, isUser, orderBy } = this.props;
    let sortIcon = orderBy && orderBy.startsWith('-') ? <span className="dtable-font dtable-icon-down3"/> : <span className="dtable-font dtable-icon-down3 rotate-180"/>;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No items')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="33%">{isUser ? gettext('User') : gettext('Organization')}</th>
                <th width="33%"><div className="d-block table-sort-op cursor-pointer" onClick={this.props.sortItems.bind(this, 'total_run_count')}>{gettext('Running count')} {orderBy.indexOf('total_run_count') !== -1 && sortIcon}</div></th>
                <th width="33%"><div className="d-block table-sort-op cursor-pointer" onClick={this.props.sortItems.bind(this, 'total_run_time')}>{gettext('Running time')} {orderBy.indexOf('total_run_time') !== -1 && sortIcon}</div></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (
                  <Item
                    key={index}
                    item={item}
                    isUser={isUser}
                  />
                );
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
            canResetPerPage={true}
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


const propTypes = {
  onCloseSidePanel: PropTypes.func
};


class StatisticRunScripts extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      perPage: 25,
      currentPage: 1,
      month: dayjs().format('YYYYMM'),
      isLoading: false,
      inputErrorMsg: '',
      errorMsg: '',
      orderBy: 'total_run_count',
      pageInfo: {
        current_page: 1,
        has_next_page: false
      },
      results: [],
      isUser: true,
    };
    this.initPage = 1;
    this.initMonth = dayjs().format('YYYYMM');
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    let isUser;
    if (!urlParams.get('is_user') || urlParams.get('is_user') === '1') {
      isUser = true;
    } else {
      isUser = false;
    }
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage),
      isUser: isUser
    }, () => {
      this.getStatisticRunScriptsByPage(this.state.currentPage);
    });
  }

  getPreviousPage = () => {
    this.getStatisticRunScriptsByPage(this.state.currentPage - 1);
  };

  getNextPage = () => {
    this.getStatisticRunScriptsByPage(this.state.currentPage + 1);
  };

  getStatisticRunScriptsByPage = (page) => {
    let { perPage, isUser, month, orderBy } = this.state;
    sysAdminServiceApi.sysAdminListScriptsRunningStatistics(isUser, month, page, perPage, orderBy).then((res) => {
      this.setState({
        loading: false,
        results: res.data.results,
        currentPage: page,
        pageInfo: {
          current_page: page,
          has_next_page: Utils.hasNextPage(page, perPage, res.data.count),
        },
        inputErrorMsg: ''
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: 'FAAS scheduler not properly configured'
          });
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

  handleChange = (e) => {
    let month = e.target.value;
    this.setState({
      month: month
    });
  };

  onKeyDown = (e) => {
    let { month } = this.state;
    if (e.key === 'Enter') {
      let pattern = /^([012]\d{3})(0[1-9]|1[012])$/;
      if (!pattern.test(month)) {
        let inputErrorMsg = gettext('Invalid month, should be yyyymm.');
        this.setState({
          inputErrorMsg: inputErrorMsg
        });
        return;
      }
      this.getStatisticRunScriptsByPage(this.initPage);
      e.target.blur();
      e.preventDefault();
    }
  };

  sortItems = (orderBy) => {
    if (this.state.orderBy.indexOf(orderBy) !== -1) {
      if (!this.state.orderBy.startsWith('-')) {
        orderBy = '-' + orderBy;
      }
    }
    this.setState({
      orderBy: orderBy
    }, () => {
      this.getStatisticRunScriptsByPage(1);
    });
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
    }, () => {
      this.getStatisticRunScriptsByPage(1);
    });
  };

  changeTabActive = (isUser) => {
    this.setState({ isUser: isUser }, () => {
      let url = new URL(location.href);
      let searchParams = new URLSearchParams({
        page: 1,
        per_page: this.state.perPage
      });
      searchParams.set('is_user', isUser ? 1 : 0);
      url.search = searchParams.toString();
      navigate(url.toString());
      this.getStatisticRunScriptsByPage(1);
    });
  };

  renderTabs = () => {
    let { isUser } = this.state;
    return (
      <div className="statistic-run-scripts-tab">
        <div className={`statistic-run-scripts-tab-item ${isUser ? 'active' : ''}`} onClick={this.changeTabActive.bind(this, true)}>{gettext('Users')}</div>
        <div className={`statistic-run-scripts-tab-item ${!isUser ? 'active' : ''}`} onClick={this.changeTabActive.bind(this, false)}>{gettext('Organizations')}</div>
      </div>
    );
  };

  render() {
    const {
      isLoading, inputErrorMsg, results, isUser,
      perPage, orderBy, pageInfo, errorMsg
    } = this.state;
    let tabs = this.renderTabs();
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="cur-view-container">
          <Nav currentItem='runScriptsStatistic' />
          <div className="cur-view-content">
            {tabs}
            <div className="d-flex align-items-center mt-4">
              <span className="statistic-reports-tip">{gettext('Month:')}</span>
              <Input
                className="statistic-reports-input"
                defaultValue={dayjs().format('YYYYMM')}
                onChange={this.handleChange}
                onKeyDown={this.onKeyDown}
              />
              {inputErrorMsg && <div className="error">{inputErrorMsg}</div>}
            </div>
            <Content
              loading={isLoading}
              errorMsg={errorMsg}
              items={results}
              curPerPage={perPage}
              pageInfo={pageInfo}
              getStatisticRunScriptsByPage={this.getStatisticRunScriptsByPage}
              resetPerPage={this.resetPerPage}
              isUser={isUser}
              sortItems={this.sortItems}
              orderBy={orderBy}
            />
          </div>
        </div>
      </Fragment>
    );
  }
}

StatisticRunScripts.propTypes = propTypes;

export default StatisticRunScripts;
