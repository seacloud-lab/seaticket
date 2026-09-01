import React, { useMemo } from 'react';
import LineComponent from '@/components/chart/view/line';
import { STATISTIC_SUMMARY_TYPE_DISPLAY } from '@/sea-metadata/constants';

import './index.css';

const Line = ({ statistic }) => {
  const data = useMemo(() => {
    const { column_key, summary_column_key, value } = statistic;
    return Array.isArray(value) ? value.map(item => ({
      name: item[column_key],
      value: item[summary_column_key] || 0,
    })) : [];
  }, [statistic]);

  return (
    <div className="sea-metadata-statistic sea-metadata-statistic-line">
      <div className="sea-metadata-statistic-line-title text-truncate mb-2" title={statistic?.name}>
        {statistic?.name}
      </div>
      <LineComponent
        data={data}
        tooltipTitle={STATISTIC_SUMMARY_TYPE_DISPLAY[statistic?.summary_type]}
      />
    </div>
  );
};

export default Line;
