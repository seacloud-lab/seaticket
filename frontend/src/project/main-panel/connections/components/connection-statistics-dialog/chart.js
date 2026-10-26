import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { max, scaleBand, scaleLinear } from 'd3';
import { gettext } from '@/constants';
import StatisticsLegend from './legend';
import { getSeriesColor, TOTAL_COLOR } from './utils';

const MARGIN = { top: 28, right: 16, bottom: 36, left: 44 };

const StatisticsChart = ({ months, series, isTotal = false }) => {
  const ref = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const height = isTotal ? 280 : 300;
  const bottom = isTotal ? 62 : MARGIN.bottom;
  const right = isTotal ? 32 : MARGIN.right;

  useLayoutEffect(() => {
    const container = ref.current;
    const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth));
    setContainerWidth(container.clientWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { width, x, groupX, y, ticks } = useMemo(() => {
    const monthWidth = isTotal ? 36 : Math.max(68, series.length * 20 + 8);
    const width = Math.max(containerWidth, MARGIN.left + right + months.length * monthWidth);
    const x = scaleBand().domain(months).range([MARGIN.left, width - right]).paddingInner(0.16).paddingOuter(0.12);
    const groupX = scaleBand().domain(series.map((item, index) => index)).range([0, x.bandwidth()]).padding(0.08);
    const largestCount = max(series, item => max(item.counts)) || 0;
    const y = scaleLinear().domain([0, Math.max(1, largestCount)]).nice(5).range([height - bottom, MARGIN.top]);
    const ticks = y.ticks(5).filter(Number.isInteger);
    return { width, x, groupX, y, ticks };
  }, [containerWidth, months, series, isTotal, height, bottom, right]);

  return (
    <>
      <StatisticsLegend series={series} isTotal={isTotal} />
      <div className="connection-statistics-chart-scroll" ref={ref}>
        <svg width={width} height={height} role="img" aria-label={isTotal ? gettext('Monthly issue count') : gettext('Monthly issues by type')}>
          {ticks.map(tick => (
            <g key={tick} className="connection-statistics-tick" transform={`translate(0, ${y(tick)})`}>
              <line x1={MARGIN.left} x2={width - right} />
              <text x={MARGIN.left - 10} dy="0.35em" textAnchor="end">{tick.toLocaleString()}</text>
            </g>
          ))}
          <line className="connection-statistics-baseline" x1={MARGIN.left} x2={width - right} y1={y(0)} y2={y(0)} />
          {months.map((month, monthIndex) => (
            <g key={month} transform={`translate(${x(month)}, 0)`}>
              <text
                className="connection-statistics-month"
                transform={`translate(${x.bandwidth() / 2}, ${height - bottom + 18})${isTotal ? ' rotate(45)' : ''}`}
                textAnchor={isTotal ? 'start' : 'middle'}
              >
                {month}
              </text>
              {series.map((item, seriesIndex) => {
                const value = item.counts[monthIndex] || 0;
                const typeName = item.issue_type || gettext('Unclassified');
                const title = `${month} / ${typeName}: ${value.toLocaleString()}`;
                const barWidth = isTotal ? Math.min(20, groupX.bandwidth() * 0.6) : groupX.bandwidth();
                const barX = groupX(seriesIndex) + (groupX.bandwidth() - barWidth) / 2;
                return (
                  <g key={seriesIndex}>
                    <rect
                      className="connection-statistics-bar"
                      x={barX}
                      y={y(value)}
                      width={barWidth}
                      height={y(0) - y(value)}
                      rx={3}
                      fill={isTotal ? TOTAL_COLOR : getSeriesColor(item.issue_type)}
                      aria-label={title}
                    >
                      <title>{title}</title>
                    </rect>
                    {value > 0 && (isTotal ? x.bandwidth() : groupX.bandwidth()) >= String(value).length * 7 && (
                      <text className="connection-statistics-value" x={barX + barWidth / 2} y={y(value) - 8} textAnchor="middle">{value.toLocaleString()}</text>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </>
  );
};

export default StatisticsChart;
