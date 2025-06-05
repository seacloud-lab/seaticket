import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { DTableEmptyTip } from 'dtable-ui-component';
import { Input, Dropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { gettext, loginUrl, siteRoot, mediaUrl } from '../../../utils/constants';
import Nav from './statistic-nav';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import MainPanelTopbar from '../main-panel-topbar';
import AutoRuleStatisticslogsDialog from '../../dtable/dialog/auto-rules-statistic-logs-dialog';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';


const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isUser: PropTypes.bool.isRequired,
  month: PropTypes.string,
  getFreeze: PropTypes.func,
  setFreeze: PropTypes.func,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isDropdownOpen: false,
      isAutoRuleLogsDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    if (this.props.getFreeze()) return;
    this.setState({
      highlight: true
    });
  };

  handleMouseOut = () => {
    if (this.props.getFreeze()) return;
    this.setState({
      highlight: false
    });
  };

  toggleAutoRuleLogsDialog = () => {
    this.setState({ isAutoRuleLogsDialogOpen: !this.state.isAutoRuleLogsDialogOpen });
  };

  toggleDropdown = () => {
    this.setState({ isDropdownOpen: !this.state.isDropdownOpen }, () => {
      this.props.setFreeze(this.state.isDropdownOpen);
      if (!this.state.isDropdownOpen) {
        this.setState({ highlight: false });
      }
    });
  };

  onListAutoRuleLogs = () => {
    this.toggleAutoRuleLogsDialog();
  };

  render() {
    const { item, isUser, month } = this.props;
    const { highlight, isDropdownOpen } = this.state;
    return (
      <Fragment>
        <tr
          className={highlight ? 'statistics-auto-rule-item tr-highlight' : 'statistics-auto-rule-item'}
          onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseOut}
        >
          <td>
            {isUser ?
              <Link to={`${siteRoot}sys/users/${encodeURIComponent(item.username)}/`}>{item.name}</Link> :
              <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>{item.org_name}</Link>
            }
          </td>
          <td>{item.trigger_count}</td>
          <td>{dayjs(item.update_at).format('YYYY-MM-DD')}</td>
          <td>
            {(highlight || isDropdownOpen) &&
              <Dropdown isOpen={isDropdownOpen} toggle={this.toggleDropdown}>
                <DropdownToggle
                  tag="span"
                  role="button"
                  className="dtable-font dtable-icon-more-level cursor-pointer"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                >
                </DropdownToggle>
                <DropdownMenu className="dtable-dropdown-menu dropdown-menu">
                  <DropdownItem className="dropdown-item" onClick={this.onListAutoRuleLogs}>{gettext('Show logs')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          </td>
        </tr>
        {this.state.isAutoRuleLogsDialogOpen &&
          <AutoRuleStatisticslogsDialog
            isUser={isUser}
            item={item}
            month={month}
            toggle={this.toggleAutoRuleLogsDialog}
          />
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
  curPerPage: PropTypes.number,
  pageInfo: PropTypes.object.isRequired,
  getStatisticAutoRulesByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  isUser: PropTypes.bool.isRequired,
  sortItems: PropTypes.func.isRequired,
  orderBy: PropTypes.string.isRequired,
  month: PropTypes.string,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.freeze = false;
  }

  setFreeze = (freeze) => {
    this.freeze = freeze;
  };

  getFreeze = () => {
    return this.freeze;
  };

  getPreviousPageList = () => {
    this.props.getStatisticAutoRulesByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.getStatisticAutoRulesByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo, isUser, month } = this.props;
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
                <th width="30%">{isUser ? gettext('User') : gettext('Organization')}</th>
                <th width="30%">
                  <div className="d-block table-sort-op">
                    {gettext('Trigger count')}
                  </div>
                </th>
                <th width="30%">
                  <div className="d-block table-sort-op">
                    {gettext('Update at')}
                  </div>
                </th>
                <th width="10%"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (
                  <Item
                    key={index}
                    item={item}
                    isUser={isUser}
                    month={month}
                    setFreeze={this.setFreeze}
                    getFreeze={this.getFreeze}
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


class StatisticAutoRules extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      perPage: 25,
      currentPage: 1,
      month: dayjs().format('YYYYMM'),
      isLoading: false,
      inputErrorMsg: '',
      errorMsg: '',
      orderBy: 'trigger_count',
      pageInfo: {
        current_page: 1,
        has_next_page: false
      },
      results: [],
      isUser: true,
    };
    this.initPage = 1;
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
      this.getStatisticAutoRulesByPage(this.state.currentPage);
    });
  }

  getPreviousPage = () => {
    this.getStatisticAutoRulesByPage(this.state.currentPage - 1);
  };

  getNextPage = () => {
    this.getStatisticAutoRulesByPage(this.state.currentPage + 1);
  };

  getStatisticAutoRulesByPage = (page) => {
    let { perPage, isUser, month, orderBy } = this.state;
    sysAdminServiceApi.sysAdminListAutoRulesStatistics(isUser, month, page, perPage, orderBy).then((res) => {
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
      this.getStatisticAutoRulesByPage(this.initPage);
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
      this.getStatisticAutoRulesByPage(1);
    });
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
    }, () => {
      this.getStatisticAutoRulesByPage(1);
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
      this.getStatisticAutoRulesByPage(1);
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
      perPage, orderBy, pageInfo, errorMsg, month
    } = this.state;
    let tabs = this.renderTabs();
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="cur-view-container">
          <Nav currentItem='autoRulesStatistic' />
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
              getStatisticAutoRulesByPage={this.getStatisticAutoRulesByPage}
              resetPerPage={this.resetPerPage}
              isUser={isUser}
              sortItems={this.sortItems}
              orderBy={orderBy}
              month={month}
            />
          </div>
        </div>
      </Fragment>
    );
  }
}

StatisticAutoRules.propTypes = propTypes;

export default StatisticAutoRules;
