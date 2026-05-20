import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from '@/utils/dayjs';
import orgAdminAPI from '@/org-admin/api';
import classnames from 'classnames';
import { gettext, orgID } from '@/constants';
import { Utils } from '@/utils/utils';
import { CenteredLoading, EmptyTip, Icon, toaster } from '@/components';
import Ring from '../view/ring';
import Bar from '../view/bar';
import Line from '../view/line';

import './index.css';

const REQUEST_STATUS = {
  LOADING: 'loading',
  EMPTY: 'empty',
  SUCCESS: 'success',
};

const REQUEST_KEYS = {
  SUMMARY: 'summary',
  SCENARIO: 'scenario',
  MONTH: 'month',
  DATE: 'date',
};

const Overview = () => {
  const [creditSummaryData, setCreditSummaryData] = useState([
    {
      key: 'current',
      name: gettext('Total credit this month'),
      value: '--',
      icon: 'total-credit-for-this-month'
    },
    {
      key: 'last',
      name: gettext('Last month total credit'),
      value: '--',
      icon: 'total-credit-for-last-month'
    },
    {
      key: 'month-on-month',
      name: gettext('Month on month changes'),
      value: '--',
      icon: 'month-on-month-change'
    },
  ]);
  const [ringData, setRingData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [requestStatus, setRequestStatus] = useState({
    [REQUEST_KEYS.SUMMARY]: REQUEST_STATUS.LOADING,
    [REQUEST_KEYS.SCENARIO]: REQUEST_STATUS.LOADING,
    [REQUEST_KEYS.MONTH]: REQUEST_STATUS.LOADING,
    [REQUEST_KEYS.DATE]: REQUEST_STATUS.LOADING,
  });

  const getLastMonthSameDay = () => {
    const today = dayjs();
    const lastMonth = today.subtract(1, 'month');

    return lastMonth.date(
      Math.min(
        today.date(),
        lastMonth.daysInMonth()
      )
    );
  };

  const monthOnMonthTip = useMemo(() => {
    // current
    const currentMonth = dayjs().format('MMM');
    const currentMonthEnd = dayjs().format('D');

    // last
    const lastMonth = dayjs().subtract(1, 'month').format('MMM');
    const lastMonthEnd = getLastMonthSameDay().format('D');

    return `(${currentMonth} 1-${currentMonthEnd} vs ${lastMonth} 1-${lastMonthEnd})`;
  }, []);

  const getMonthOnMonthValue = (current_month_credit, last_month_same_day_credit) => {
    const currentCredit = Number(current_month_credit) || 0;
    const lastMonthSameDayCredit = Number(last_month_same_day_credit) || 0;

    let monthOnMonthValue = '--';
    if (lastMonthSameDayCredit === 0) {
      if (currentCredit > 0) {
        monthOnMonthValue = '100%';
      }
    } else {
      const changePercent = ((currentCredit - lastMonthSameDayCredit) / lastMonthSameDayCredit) * 100;
      monthOnMonthValue = `${changePercent.toFixed(2)}%`;
    }
    return monthOnMonthValue;
  };

  const setStatus = useCallback((key, status) => {
    setRequestStatus((prev) => ({
      ...prev,
      [key]: status,
    }));
  }, []);

  const buildSummaryData = useCallback((summaryData = {}) => {
    const { current_month_credit, last_month_credit, last_month_same_day_credit } = summaryData;

    const newCreditHeaderData = creditSummaryData.map(item => {
      if (item.key === 'current') {
        item.value = current_month_credit || '--';
      } else if (item.key === 'last') {
        item.value = last_month_credit || '--';
      } else if (item.key === 'month-on-month') {
        item.value = getMonthOnMonthValue(current_month_credit, last_month_same_day_credit);
      }
      return item;
    });

    setCreditSummaryData(newCreditHeaderData);
    return true;
  }, []);

  const buildScenarioData = useCallback((scenarioData = {}) => {
    const results = Array.isArray(scenarioData.results) ? scenarioData.results : [];
    const validData = results
      .map(item => ({
        name: item.scenario || gettext('Unknown'),
        value: Number(item.total_credit_used) || 0,
        percentage: `${(item.percentage * 100).toFixed(1)}%`,
      })).filter(item => item.value > 0);
    setRingData(validData);
    return validData.length > 0;
  }, []);

  const buildMonthData = useCallback((monthData = {}) => {
    const results = Array.isArray(monthData.results) ? monthData.results : [];
    const validData = results.map(item => {
      return {
        name: item.month,
        value: Number(item.total_credit_used) || 0,
      };
    });
    setBarData(validData);
    return validData.some(item => item.value > 0);
  }, []);

  const buildDateData = useCallback((dateData = {}) => {
    const results = Array.isArray(dateData.results) ? dateData.results : [];
    const validData = results.map(item => {
      return {
        name: item.date,
        value: Number(item.total_credit_used) || 0,
      };
    });
    setLineData(validData);
    return validData.some(item => item.value > 0);
  }, []);

  const loadOverviewData = useCallback(async (statusKey, groupBy, dataBuilder, cancelledRef) => {
    setStatus(statusKey, REQUEST_STATUS.LOADING);
    try {
      const res = await orgAdminAPI.orgAdminGetAIStatisticsOverview(orgID, groupBy);
      if (cancelledRef.current) return;
      const hasData = dataBuilder(res?.data || {});
      setStatus(statusKey, hasData ? REQUEST_STATUS.SUCCESS : REQUEST_STATUS.EMPTY);
    } catch (error) {
      if (cancelledRef.current) return;
      setStatus(statusKey, REQUEST_STATUS.EMPTY);
      toaster.danger(Utils.getErrorMsg(error));
    }
  }, [setStatus, buildSummaryData, buildScenarioData, buildMonthData, buildDateData]);

  useEffect(() => {
    const cancelledRef = { current: false };

    loadOverviewData(REQUEST_KEYS.SUMMARY, undefined, buildSummaryData, cancelledRef);
    loadOverviewData(REQUEST_KEYS.SCENARIO, 'scenario', buildScenarioData, cancelledRef);
    loadOverviewData(REQUEST_KEYS.MONTH, 'month', buildMonthData, cancelledRef);
    loadOverviewData(REQUEST_KEYS.DATE, 'date', buildDateData, cancelledRef);

    return () => {
      cancelledRef.current = true;
    };
  }, [loadOverviewData, buildSummaryData, buildScenarioData, buildMonthData, buildDateData]);

  const renderSectionContent = useCallback((status, children) => {
    if (status === REQUEST_STATUS.LOADING) {
      return (
        <div className="overview-chart-state d-flex align-items-center justify-content-center flex-1">
          <CenteredLoading />
        </div>
      );
    }

    if (status === REQUEST_STATUS.EMPTY) {
      return (
        <div className="overview-chart-state flex-1">
          <EmptyTip title={gettext('No data')} />
        </div>
      );
    }

    return children;
  }, []);

  return (
    <div className="overview-chart-wrapper d-flex flex-column">
      <div className="overview-chart-header">
        {creditSummaryData.map((item) => (
          <div key={item.key} className={`credit-header-item ${item.key}`}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="title">{item.name}</div>
              <div className="icon d-flex align-items-center justify-content-center"><Icon symbol={item.icon} /></div>
            </div>
            <div className="tip">{item.key === 'month-on-month' ? monthOnMonthTip : ''}</div>
            <div className="value">
              {(item.key === 'month-on-month' && parseFloat(item.value) !== 0) && (
                <span className={classnames('d-flex', { 'rotate-icon-180': parseFloat(item.value) < 0 })}>
                  <Icon symbol="btn-send"/>
                </span>
              )}
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="overview-chart-center d-flex">
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Credit proportion')}</div>
          {renderSectionContent(requestStatus[REQUEST_KEYS.SCENARIO], <Ring data={ringData} />)}
        </div>
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Monthly credit consumption trend')}</div>
          {renderSectionContent(requestStatus[REQUEST_KEYS.MONTH], <Bar data={barData} />)}
        </div>
      </div>
      <div className="overview-chart-footer">
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Daily credit consumption trend this month')}</div>
          {renderSectionContent(requestStatus[REQUEST_KEYS.DATE], <Line data={lineData} />)}
        </div>
      </div>
    </div>
  );
};

export default Overview;
