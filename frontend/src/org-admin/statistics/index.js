import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import classNames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { CenteredLoading } from '@/components';
import { gettext, siteRoot, orgID } from '@/constants';
import { Utils } from '@/utils/utils';
import toaster from '@/components/toaster';
import orgAdminAPI from '../api';
import MainPanelTopbar from '../main-panel/top-bar';
import Paginator from '@/components/paginator';
import StatisticNav from './statistic-nav';
import CapsuleTabs from '@/components/capsule-tabs/capsule-tabs';

import '@/css/statistics.css';

import Picker from '../../project/main-panel/search/date-and-time-picker';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  groupBy: PropTypes.string.isRequired
};

class Item extends Component {
  constructor(props) {
    super(props);
    this.state = {
      highlight: false
    };
  }

  handleMouseEnter = () => {
    this.setState({ highlight: true });
  };

  handleMouseLeave = () => {
    this.setState({ highlight: false });
  };

  getOwnerURL = (owner) => {
    if (!owner) return '';
    if (owner.indexOf('@seafile_group') !== -1) {
      return `${siteRoot}org/groups/${owner.split('@')[0]}/`;
    } else {
      return `${siteRoot}org/users/info/${encodeURIComponent(owner)}/`;
    }
  };

  render() {
    const { item, groupBy } = this.props;
    const { highlight } = this.state;

    return (
      <tr
        className={highlight ? 'tr-highlight' : ''}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        {groupBy === 'owner' && (
          <>
            <td>
              {(item.nickname || item.group_name) && (
                <Link to={this.getOwnerURL(item.owner)}>
                  {item.group_name ? item.group_name : item.nickname}
                </Link>
              )}
              {!(item.nickname || item.group_name) && item.owner}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'project' && (
          <>
            <td>{item.project_name || item.project_uuid}</td>
            <td>
              {(item.nickname || item.group_name) && (
                <Link to={this.getOwnerURL(item.owner)}>
                  {item.group_name ? item.group_name : item.nickname}
                </Link>
              )}
              {!(item.nickname || item.group_name) && item.owner}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'workspace' && (
          <>
            <td>
              <Link to={this.getOwnerURL(item.owner)}>
                {item.workspace_name}
              </Link>
            </td>
            <td><Link to={this.getOwnerURL(item.creator)}>{item.creator_name}</Link></td>
            <td>{item.total_cost}</td>
          </>
        )}
      </tr>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number.isRequired,
  pageInfo: PropTypes.object.isRequired,
  getStatisticsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  groupBy: PropTypes.string.isRequired
};

class Content extends Component {
  getPreviousPage = () => {
    this.props.getStatisticsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPage = () => {
    this.props.getStatisticsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo, groupBy, curPerPage, resetPerPage } = this.props;

    if (loading) {
      return <CenteredLoading />;
    }

    if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    }

    if (items.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          {gettext('No items')}
        </div>
      );
    }
    return (
      <Fragment>
        <table className="table table-hover table-vcenter">
          <thead>
            {groupBy === 'owner' && (
              <tr>
                <th>{`${gettext('User')}`}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'project' && (
              <tr>
                <th width="40%">{gettext('Project')}</th>
                <th width="35%">{`${gettext('User')} / ${gettext('Group')}`}</th>
                <th width="25%">{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'workspace' && (
              <tr>
                <th>{gettext('Workspace')}</th>
                <th>{gettext('Creator')}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.map((item, index) => (
              <Item key={index} item={item} groupBy={groupBy} />
            ))}
          </tbody>
        </table>
        <Paginator
          gotoPreviousPage={this.getPreviousPage}
          gotoNextPage={this.getNextPage}
          currentPage={pageInfo.current_page}
          hasNextPage={pageInfo.has_next_page}
          canResetPerPage={true}
          curPerPage={curPerPage}
          resetPerPage={resetPerPage}
        />
      </Fragment>
    );
  }
}

Content.propTypes = contentPropTypes;

class StatisticsAI extends Component {
  constructor(props) {
    super(props);
    this.state = {
      perPage: 25,
      currentPage: 1,
      date: dayjs(),
      month: dayjs().format('YYYYMM'),
      isLoading: true,
      errorMsg: '',
      pageInfo: {
        current_page: 1,
        has_next_page: false
      },
      results: [],
      groupBy: 'owner',
      queryDate: 'date'
    };
    this.initPage = 1;
    this.dateTabList = [
      {
        label: gettext('By date'),
        value: 'date'
      },
      {
        label: gettext('By month'),
        value: 'month'
      },
    ];
  }

  componentDidMount() {
    this.getStatisticsByPage(this.state.currentPage);
  }

  getStatisticsByPage = (page) => {
    const { perPage, date, month, groupBy, queryDate } = this.state;
    this.setState({ isLoading: true });

    let dateParam = null;
    let monthParam = null;

    if (queryDate === 'month' && (groupBy === 'project' || groupBy === 'workspace')) {
      monthParam = month;
    } else {
      dateParam = date.format('YYYY-MM-DD');
    }

    orgAdminAPI.orgAdminGetAIStatistics(orgID, dateParam, monthParam, groupBy, page, perPage)
      .then(res => {
        this.setState({
          isLoading: false,
          results: res.data.results,
          currentPage: page,
          pageInfo: {
            current_page: page,
            has_next_page: Utils.hasNextPage(page, perPage, res.data.count)
          },
          errorMsg: ''
        });
      })
      .catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
        this.setState({
          isLoading: false,
          errorMsg: errMessage
        });
      });
  };

  onDateChange = (value) => {
    if (value && value.isValid()) {
      this.setState({
        date: value,
        currentPage: this.initPage,
        results: []
      }, () => {
        this.getStatisticsByPage(this.initPage);
      });
    }
  };

  onMonthChange = (e) => {
    const value = e.target.value;
    if (value) {
      const month = value.replace('-', '');
      this.setState({
        month: month,
        currentPage: this.initPage,
        results: []
      }, () => {
        this.getStatisticsByPage(this.initPage);
      });
    }
  };

  resetPerPage = (newPerPage) => {
    this.setState({
      perPage: newPerPage,
      currentPage: this.initPage
    }, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  changeTabActive = (groupBy) => {
    if (groupBy === this.state.groupBy) {
      return;
    }
    const newState = {
      groupBy: groupBy,
      currentPage: this.initPage,
      results: []
    };

    if (groupBy === 'owner') {
      newState.queryDate = 'date';
    }

    this.setState(newState, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  changeQueryDateTab = (index) => {
    const queryDate = this.dateTabList[index].value;
    if (queryDate === this.state.queryDate) {
      return;
    }
    this.setState({
      queryDate: queryDate,
      currentPage: this.initPage,
      results: []
    }, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  render() {
    const { isLoading, results, groupBy, queryDate, perPage, pageInfo, errorMsg, date, month } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <StatisticNav currentItem="ai" />
            <div className="cur-view-content">
              <div className="statistic-tabs">
                <div
                  className={`statistic-tab-item ${groupBy === 'owner' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('owner')}
                >
                  {gettext('Users')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'project' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('project')}
                >
                  {gettext('Project')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'workspace' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('workspace')}
                >
                  {gettext('Workspace')}
                </div>
              </div>
              <div className="d-flex mb-4">
                {groupBy !== 'owner' &&
                  <CapsuleTabs
                    tabs={this.dateTabList}
                    defaultActiveIndex={this.dateTabList.findIndex(tab => tab.value === queryDate)}
                    onTabChange={this.changeQueryDateTab}
                  />
                }
                <div className={classNames('d-flex align-items-center', { 'ml-6': groupBy !== 'owner' })}>
                  {queryDate === 'date' && (
                    <>
                      <span className="mr-2 111">{`${gettext('Date')}:`}</span>
                      <Picker
                        showHourAndMinute={false}
                        disabledDate={() => false}
                        value={date}
                        onChange={this.onDateChange}
                        inputWidth={118}
                      />
                    </>
                  )}
                  {queryDate === 'month' && (
                    <>
                      <span className="mr-2">{`${gettext('Month')}:`}</span>
                      <input
                        type="month"
                        className="form-control"
                        style={{ width: '200px' }}
                        value={month.slice(0, 4) + '-' + month.slice(4)}
                        onChange={this.onMonthChange}
                      />
                    </>
                  )}
                </div>
              </div>
              <Content
                loading={isLoading}
                errorMsg={errorMsg}
                items={results}
                curPerPage={perPage}
                pageInfo={pageInfo}
                getStatisticsByPage={this.getStatisticsByPage}
                resetPerPage={this.resetPerPage}
                groupBy={groupBy}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

StatisticsAI.propTypes = propTypes;

export default StatisticsAI;
