import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import Tooltip from '../token-credit-used/tooltip';
import { Icon } from '@/components';
import Ring from '../view/ring';

import './index.css';

const formatCreditUsed = (value) => {
  if (value === 0) return '0';
  const withDecimals = value.toFixed(0);
  const trimmed = withDecimals.replace(/\.?0+$/, '');
  return trimmed;
};

const Overview = () => {
  const [creditHeaderData, setCreditHeaderData] = useState([
    { key: 'current', name: gettext('Total Credit for this month'), value: '$ 40,00' },
    { key: 'last', name: gettext('Last month total credit'), value: '$ 5650' },
    { key: 'month-on-month', name: gettext('Month on month changes'), value: '$ 43,350' },
  ]);
  const [ringData, setRingData] = useState([
    { name: 'SceneA', value: 70 },
    { name: 'SceneB', value: 40 },
    { name: 'SceneC', value: 80 },
  ]);

  return (
    <div className="overview-chart-wrapper d-flex flex-column">
      <div className="overview-chart-header">
        {creditHeaderData.map((item) => (
          <div key={item.key} className={`credit-header-item ${item.key}`}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="title">{item.name}</div>
              <div className="icon d-flex align-items-center justify-content-center"><Icon symbol="plus"/></div>
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
          <div className="chart-name">{gettext('Grouping quantity')}</div>
          <svg></svg>
        </div>
      </div>
      <div className="overview-chart-footer">
        <div className="chart-wrapper d-flex flex-column">
          <div className="chart-name">{gettext('Grouping quantity')}</div>
          <svg></svg>
        </div>
      </div>
    </div>
  );
};

export default Overview;
