import React from 'react';
import { gettext } from '@/constants';
import { getSeriesColor, TOTAL_COLOR } from './utils';

const StatisticsLegend = ({ series, isTotal = false }) => (
  <ul className="connection-statistics-legend">
    {series.map((item, index) => (
      <li key={index}>
        <span className="connection-statistics-swatch" style={{ backgroundColor: isTotal ? TOTAL_COLOR : getSeriesColor(item.issue_type) }} />
        <span>{item.issue_type || gettext('Unclassified')}</span>
      </li>
    ))}
  </ul>
);

export default StatisticsLegend;
