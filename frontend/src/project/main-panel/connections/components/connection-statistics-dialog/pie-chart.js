import React, { useMemo } from 'react';
import { Legend, Ring } from '@/components/chart/view';
import { gettext } from '@/constants';
import { getSeriesColor } from './utils';

const StatisticsPieChart = ({ series }) => {
  const data = useMemo(() => series.map(item => ({
    name: item.issue_type || gettext('Unclassified'),
    value: item.counts.reduce((sum, count) => sum + count, 0),
    color: getSeriesColor(item.issue_type),
  })), [series]);

  return (
    <div className="chart-pie-layout">
      <Ring data={data} variant="pie" ariaLabel={gettext('Issue types')} />
      <Legend data={data} />
    </div>
  );
};

export default StatisticsPieChart;
