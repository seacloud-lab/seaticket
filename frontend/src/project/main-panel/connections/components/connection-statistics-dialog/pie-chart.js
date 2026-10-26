import React, { useMemo } from 'react';
import { arc, pie } from 'd3';
import { gettext } from '@/constants';
import StatisticsLegend from './legend';
import { getSeriesColor } from './utils';

const RADIUS = 132;
const slicePath = arc().innerRadius(0).outerRadius(RADIUS);
const labelPosition = arc().innerRadius(RADIUS * 0.58).outerRadius(RADIUS * 0.58);

const StatisticsPieChart = ({ series }) => {
  const { slices, total } = useMemo(() => {
    const data = series.map(item => ({
      ...item,
      total: item.counts.reduce((sum, count) => sum + count, 0),
    })).filter(item => item.total > 0);
    const total = data.reduce((sum, item) => sum + item.total, 0);
    const labelBounds = [];
    const slices = pie().sort(null).value(item => item.total)(data).map(slice => {
      const percentage = `${(slice.data.total / total * 100).toFixed(1)}%`;
      const [x, y] = labelPosition.centroid(slice);
      const halfWidth = percentage.length * 4 + 2;
      const bounds = { left: x - halfWidth, right: x + halfWidth, top: y - 10, bottom: y + 10 };
      const showLabel = slice.endAngle - slice.startAngle >= 0.2 && !labelBounds.some(other =>
        bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top
      );
      if (showLabel) labelBounds.push(bounds);
      return { ...slice, percentage, x, y, showLabel };
    });
    return {
      slices,
      total,
    };
  }, [series]);

  return (
    <div className="connection-statistics-pie-layout">
      <svg viewBox="0 0 300 300" role="img" aria-label={gettext('Issue types')}>
        <g transform="translate(150, 150)">
          {total === 0 && <circle className="connection-statistics-pie-empty" r={RADIUS} />}
          {slices.map((slice, index) => {
            const name = slice.data.issue_type || gettext('Unclassified');
            const title = `${name}: ${slice.data.total.toLocaleString()} (${slice.percentage})`;
            return (
              <g key={index}>
                <path
                  className="connection-statistics-slice"
                  d={slicePath(slice)}
                  fill={getSeriesColor(slice.data.issue_type)}
                  aria-label={title}
                >
                  <title>{title}</title>
                </path>
                {slice.showLabel && (
                  <text className="connection-statistics-percentage" x={slice.x} y={slice.y} dy="0.35em" textAnchor="middle">{slice.percentage}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <StatisticsLegend series={series} />
    </div>
  );
};

export default StatisticsPieChart;
