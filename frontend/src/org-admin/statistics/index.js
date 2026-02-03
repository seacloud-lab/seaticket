import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { CenteredLoading, EmptyTip } from '@/components';
import { gettext, siteRoot, orgID, mediaUrl } from '@/constants';
import { Utils } from '@/utils/utils';
import toaster from '@/components/toaster';
import orgAdminAPI from '../api';
import MainPanelTopbar from '../main-panel/top-bar';
import Paginator from '@/components/paginator';
import StatisticNav from './statistic-nav';
import CapsuleTabs from '@/components/capsule-tabs/capsule-tabs';
import DateAndTimePicker from '../../project/main-panel/search/date-and-time-picker';
import MonthPicker from '../../project/main-panel/search/month-picker';

import '@/css/statistics.css';
import { Label } from 'reactstrap';

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

  getGroupURL = (groupID) => {
    return `${siteRoot}org/groups/${groupID}/`;
  };

  getOwnerURL = (owner) => {
    if (!owner) return '';
    if (owner.indexOf('@seafile_group') !== -1) {
      return this.getGroupURL(owner.split('@')[0]);
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
        {groupBy === 'user' && (
          <>
            <td>
              <Link to={this.getOwnerURL(item.username)}>
                {item.nickname}
              </Link>
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'project' && (
          <>
            <td>{item.project_name || item.project_uuid}</td>
            <td>
              {(item.nickname || item.group_name) && item.group_name ? (
                <div>
                  <Link to={this.getOwnerURL(item.owner)}>{item.group_name}</Link>
                  {' '}
                  <Label>{'(' + gettext('group') + ')'}</Label>
                </div>
              ) : (
                <Link to={this.getOwnerURL(item.owner)}>
                  {item.group_name ? item.group_name : item.nickname}
                </Link>
              )}
              {!(item.nickname || item.group_name) && item.owner}
            </td>
            <td>{item.total_cost}</td>
          </>
        )}
        {groupBy === 'group' && (
          <>
            <td>
              <Link to={this.getGroupURL(item.group_id)}>
                {item.group_name}
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

Item.propTypes = {
  item: PropTypes.object.isRequired,
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
        <div className="h-100">
          <EmptyTip
            src={`${mediaUrl}img/no-items-tip.png`}
            title={gettext('No items')}
          />
        </div>
      );
    }
    return (
      <Fragment>
        <table className="table table-hover table-vcenter">
          <thead>
            {groupBy === 'user' && (
              <tr>
                <th>{`${gettext('User')}`}</th>
                <th>{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'project' && (
              <tr>
                <th width="40%">{gettext('Project')}</th>
                <th width="35%">{`${gettext('Owner')}`}</th>
                <th width="25%">{gettext('Cost')}</th>
              </tr>
            )}
            {groupBy === 'group' && (
              <tr>
                <th>{gettext('Group')}</th>
                <th>{gettext('Owner')}</th>
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

Content.propTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number.isRequired,
  pageInfo: PropTypes.object.isRequired,
  getStatisticsByPage: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  groupBy: PropTypes.string.isRequired
};

class StatisticsAI extends Component {
  constructor(props) {
    super(props);
    this.state = {
      perPage: 25,
      currentPage: 1,
      date: dayjs(),
      month: dayjs(),
      isLoading: true,
      errorMsg: '',
      pageInfo: {
        current_page: 1,
        has_next_page: false
      },
      results: [],
      groupBy: 'user',
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
    const dateParam = queryDate === 'month' ? null : date.format('YYYY-MM-DD');
    const monthParam = queryDate === 'month' ? month.format('YYYYMM') : null;

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

  onDateChange = (date) => {
    if (date && date.isValid()) {
      this.setState({
        date: date,
        currentPage: this.initPage,
        results: []
      }, () => {
        this.getStatisticsByPage(this.initPage);
      });
    }
  };

  onMonthChange = (month) => {
    if (month && month.isValid()) {
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
                  className={`statistic-tab-item ${groupBy === 'user' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('user')}
                >
                  {gettext('Users')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'project' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('project')}
                >
                  {gettext('Projects')}
                </div>
                <div
                  className={`statistic-tab-item ${groupBy === 'group' ? 'active' : ''}`}
                  onClick={() => this.changeTabActive('group')}
                >
                  {gettext('Groups')}
                </div>
              </div>
              <div className="d-flex mb-4">
                <CapsuleTabs
                  tabs={this.dateTabList}
                  defaultActiveIndex={this.dateTabList.findIndex(tab => tab.value === queryDate)}
                  onTabChange={this.changeQueryDateTab}
                />
                <div className='d-flex align-items-center ml-6'>
                  {queryDate === 'date' && (
                    <>
                      <span className="mr-2">{`${gettext('Date')}:`}</span>
                      <DateAndTimePicker
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
                      <MonthPicker
                        value={month}
                        onChange={this.onMonthChange}
                        disabledDate={(date) => date.isAfter(dayjs().add(1, 'month').startOf('month'))}
                        inputWidth={94}
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

StatisticsAI.propTypes = {
  onCloseSidePanel: PropTypes.func
};

export default StatisticsAI;
