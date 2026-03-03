import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { CustomizeTabs, toaster } from '@/components';
import sysAdminAPI from '../api';
import { TopBar } from '../main-panel';
import StatisticNav from './statistic-nav';
import CapsuleTabs from '@/components/capsule-tabs/capsule-tabs';
import DateAndTimePicker from '../../project/main-panel/search/date-and-time-picker';
import MonthPicker from '../../project/main-panel/search/month-picker';
import { TokenCostDetailDialog } from '@/components/dialog';
import StatisticList from './statistic-list';

import '@/css/statistics.css';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class Statistics extends Component {
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
      queryDate: 'date',
      isOpenStatisticsDetailDialog: false,
      statisticsDetailModels: [],
      statisticsDetailBasicCondition: {},
      hasFreezed: false,
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
    this.statisticsDetailViews = [
      { value: 'date', label: gettext('Date') },
    ];
  }

  componentDidMount() {
    this.getStatisticsByPage(this.state.currentPage);
  }

  getAIStatisticsModels = (condition) => {
    const { groupBy } = this.state;
    return sysAdminAPI.sysAdminGetAIStatisticsModels(groupBy, condition);
  };

  getAIStatisticsDetail = (view, models, condition) => {
    return sysAdminAPI.sysAdminGetAIStatisticsDetail(view, models, condition);
  };

  onOpenAIStaticsDetailDialog = (groupBy, condition) => {
    this.statisticsDetailViews = [
      { value: 'date', label: gettext('Date') },
    ];
    if (groupBy === 'project' || groupBy === 'group') {
      this.statisticsDetailViews.push({
        value: 'user', label: gettext('User')
      });
    }
    if (groupBy === 'user' || groupBy === 'group') {
      this.statisticsDetailViews.push({
        value: 'project', label: gettext('Project')
      });
    }
    this.setState({ isOpenStatisticsDetailDialog: true, statisticsDetailBasicCondition: condition });
  };

  onCloseAIStaticsDetailDialog = () => {
    this.statisticsDetailViews = [
      { value: 'date', label: gettext('Date') },
    ];
    this.setState({ isOpenStatisticsDetailDialog: false, statisticsDetailBasicCondition: {} });
  };

  getStatisticsByPage = (page) => {
    const { perPage, date, month, groupBy, queryDate } = this.state;
    this.setState({ isLoading: true });
    const dateParam = queryDate === 'month' ? null : date.format('YYYY-MM-DD');
    const monthParam = queryDate === 'month' ? month.format('YYYYMM') : null;

    sysAdminAPI.sysAdminGetAIStatistics(dateParam, monthParam, groupBy, page, perPage)
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
        results: [],
        hasFreezed: false,
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
        results: [],
        hasFreezed: false,
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
    if (groupBy === this.state.groupBy) return;
    const newState = {
      groupBy: groupBy,
      currentPage: this.initPage,
      hasFreezed: false,
      results: [],
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
      results: [],
      hasFreezed: false,
    }, () => {
      this.getStatisticsByPage(this.initPage);
    });
  };

  updateFreezed = (hasFreezed) => {
    this.setState({ hasFreezed });
  };

  render() {
    const {
      isLoading, results, groupBy, queryDate, perPage, pageInfo, errorMsg, date, month,
      isOpenStatisticsDetailDialog, statisticsDetailBasicCondition,
      hasFreezed,
    } = this.state;

    return (
      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <StatisticNav currentItem="ai" />
            <div className="cur-view-content">
              <CustomizeTabs
                className="statistic-tabs"
                value={groupBy}
                tabs={[
                  { value: 'user', label: gettext('Users') },
                  { value: 'project', label: gettext('Projects') },
                  { value: 'group', label: gettext('Groups') },
                  { value: 'org', label: gettext('Organizations') },
                ]}
                onChange={this.changeTabActive}
              />
              <div className="d-flex align-items-center mt-4 mb-4">
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
              <StatisticList
                loading={isLoading}
                errorMsg={errorMsg}
                items={results}
                curPerPage={perPage}
                pageInfo={pageInfo}
                getStatisticsByPage={this.getStatisticsByPage}
                resetPerPage={this.resetPerPage}
                groupBy={groupBy}
                hasFreezed={hasFreezed}
                updateFreezed={this.updateFreezed}
                onOpenAIStaticsDetailDialog={this.onOpenAIStaticsDetailDialog}
              />
            </div>
            {isOpenStatisticsDetailDialog && (
              <TokenCostDetailDialog
                views={this.statisticsDetailViews}
                onCloseDialog={this.onCloseAIStaticsDetailDialog}
                getAIStatisticsModels={this.getAIStatisticsModels}
                getAIStatisticsDetail={this.getAIStatisticsDetail}
                basicCondition={statisticsDetailBasicCondition}
              />
            )}
          </div>
        </div>
      </Fragment>
    );
  }
}

Statistics.propTypes = propTypes;

export default Statistics;
