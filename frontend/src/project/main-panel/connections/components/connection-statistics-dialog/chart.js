import React, { useMemo } from 'react';
import { Bar, Legend } from '@/components/chart/view';
import { gettext } from '@/constants';
import { getSeriesColor, TOTAL_COLOR } from './utils';

const GROUPED_OPTIONS = { height: 300, showValues: true, integerTicks: true, minCategoryWidth: 68 };
const TOTAL_OPTIONS = { height: 280, showValues: true, integerTicks: true, minCategoryWidth: 36, labelRotation: 45, maxBarWidth: 20 };

const StatisticsChart = ({ months, series, isTotal = false }) => {
  const legend = useMemo(() => series.map(item => ({
    name: item.issue_type || gettext('Unclassified'),
    color: isTotal ? TOTAL_COLOR : getSeriesColor(item.issue_type),
  })), [series, isTotal]);
  const data = useMemo(() => months.map((name, monthIndex) => ({
    name,
    values: series.map((item, seriesIndex) => ({
      ...legend[seriesIndex],
      value: item.counts[monthIndex] || 0,
    })),
  })), [months, series, legend]);

  return (
    <>
      <Legend data={legend} />
      <Bar
        data={data}
        options={isTotal ? TOTAL_OPTIONS : GROUPED_OPTIONS}
        ariaLabel={isTotal ? gettext('Monthly issue count') : gettext('Monthly issues by type')}
      />
    </>
  );
};

export default StatisticsChart;
