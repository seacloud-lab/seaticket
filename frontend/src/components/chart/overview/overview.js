import React, { useRef, useEffect, useState } from 'react';
import { gettext } from '@/constants';
import { Icon } from '@/components';
import Ring from '../view/ring';
import Bar from '../view/bar';
import Line from '../view/line';

import './index.css';

const Overview = () => {
  const [creditHeaderData, setCreditHeaderData] = useState([
    { key: 'current', name: gettext('Total Credit for this month'), value: '$ 40,00', icon: 'total-credit-for-this-month' },
    { key: 'last', name: gettext('Last month total credit'), value: '$ 5650', icon: 'total-credit-for-last-month' },
    { key: 'month-on-month', name: gettext('Month on month changes'), value: '$ 43,350', icon: 'month-on-month-change' },
  ]);
  const [ringData, setRingData] = useState([
    { name: 'SceneA', value: 70 },
    { name: 'SceneB', value: 40 },
    { name: 'SceneC', value: 80 },
  ]);
  const [barData, setBarData] = useState([
    { name: '一月', value: 70 },
    { name: '二月', value: 40 },
    { name: '三月', value: 80 },
    { name: '四月', value: 70 },
    { name: '五月', value: 40 },
    { name: '六月', value: 80 },
    { name: '七月', value: 70 },
    { name: '八月', value: 40 },
    { name: '九月', value: 80 },
    { name: '十月', value: 70 },
    { name: '十一月', value: 40 },
    { name: '十二月', value: 80 },
  ]);
  const [lineData, setLineData] = useState([
    { name: '1', value: 70 },
    { name: '2', value: 40 },
    { name: '3', value: 80 },
    { name: '4', value: 70 },
    { name: '5', value: 40 },
    { name: '6', value: 80 },
    { name: '7', value: 70 },
    { name: '8', value: 40 },
    { name: '9', value: 80 },
    { name: '10', value: 70 },
    { name: '11', value: 40 },
    { name: '12', value: 80 },
    { name: '13', value: 40 },
    { name: '14', value: 18 },
    { name: '15', value: 70 },
    { name: '16', value: 40 },
    { name: '17', value: 80 },
    { name: '18', value: 20 },
    { name: '19', value: 80 },
    { name: '20', value: 70 },
    { name: '21', value: 40 },
    { name: '22', value: 80 },
    { name: '23', value: 40 },
    { name: '24', value: 80 },
    { name: '25', value: 70 },
    { name: '26', value: 40 },
    { name: '27', value: 0 },
    { name: '28', value: 40 },
    { name: '29', value: 80 },
    { name: '30', value: 40 },
    { name: '31', value: 80 },
  ]);

  return (
    <div className="overview-chart-wrapper d-flex flex-column">
      <div className="overview-chart-header">
        {creditHeaderData.map((item) => (
          <div key={item.key} className={`credit-header-item ${item.key}`}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="title">{item.name}</div>
              <div className="icon d-flex align-items-center justify-content-center"><Icon symbol={item.icon}/></div>
            </div>
            <div className="value">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="overview-chart-center d-flex">
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Credit proportion')}</div>
          <Ring data={ringData} />
        </div>
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Monthly credit consumption trend')}</div>
          <Bar data={barData} />
        </div>
      </div>
      <div className="overview-chart-footer">
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Daily Credit Consumption Trend This Month')}</div>
          <Line data={lineData} />
        </div>
      </div>
    </div>
  );
};

export default Overview;
