import React, { useCallback, useEffect, useState } from 'react';
import orgAdminAPI from '@/org-admin/api';
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
      name: gettext('Total Credit for this month'),
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

  const setStatus = useCallback((key, status) => {
    setRequestStatus((prev) => ({
      ...prev,
      [key]: status,
    }));
  }, []);

  const buildSummaryData = useCallback((summaryData = {}) => {
    const { current_month_credit, last_month_credit, month_on_month_change } = summaryData;

    const newCreditHeaderData = creditSummaryData.map(item => {
      if (item.key === 'current') {
        item.value = current_month_credit || '--';
      } else if (item.key === 'last') {
        item.value = last_month_credit || '--';
      } else if (item.key === 'month-on-month') {
        item.value = month_on_month_change || '--';
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
            <div className="value">{item.value}</div>
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
          <div className="chart-name">{gettext('Daily Credit Consumption Trend This Month')}</div>
          {renderSectionContent(requestStatus[REQUEST_KEYS.DATE], <Line data={lineData} />)}
        </div>
      </div>
    </div>
  );
};

export default Overview;
