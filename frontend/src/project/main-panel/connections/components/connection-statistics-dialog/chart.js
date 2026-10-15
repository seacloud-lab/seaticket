import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { max, scaleBand, scaleLinear } from 'd3';
import { gettext } from '@/constants';

const HEIGHT = 360;
const MARGIN = { top: 28, right: 20, bottom: 46, left: 56 };
const TYPE_COLORS = { bug: '#377eb8', feature: '#4b9e46', question: '#ed8732' };
const CUSTOM_COLORS = ['#8c5db5', '#168d8d', '#bd4a64', '#b59a27', '#56667a', '#32795e'];

export function getSeriesColor(issueType) {
  if (!issueType) return '#999999';
  const name = issueType.toLowerCase();
  if (TYPE_COLORS[name]) return TYPE_COLORS[name];
  const hash = Array.from(name).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return CUSTOM_COLORS[hash % CUSTOM_COLORS.length];
}

const StatisticsChart = ({ months, series }) => {
  const ref = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const container = ref.current;
    const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth));
    setContainerWidth(container.clientWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { width, x, groupX, y, ticks } = useMemo(() => {
    const width = Math.max(containerWidth, MARGIN.left + MARGIN.right + months.length * Math.max(60, series.length * 18 + 8));
    const x = scaleBand().domain(months).range([MARGIN.left, width - MARGIN.right]).paddingInner(0.16).paddingOuter(0.12);
    const groupX = scaleBand().domain(series.map((item, index) => index)).range([0, x.bandwidth()]).padding(0.08);
    const largestCount = max(series, item => max(item.counts)) || 0;
    const y = scaleLinear().domain([0, Math.max(1, largestCount)]).nice(5).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
    const ticks = y.ticks(5).filter(Number.isInteger);
    return { width, x, groupX, y, ticks };
  }, [containerWidth, months, series]);

  return (
    <>
      <ul className="connection-statistics-legend">
        {series.map((item, index) => (
          <li key={index}>
            <span className="connection-statistics-swatch" style={{ backgroundColor: getSeriesColor(item.issue_type) }} />
            <span>{item.issue_type || gettext('Unclassified')}</span>
          </li>
        ))}
      </ul>
      <div className="connection-statistics-chart-scroll" ref={ref}>
        <svg width={width} height={HEIGHT} role="img" aria-label={gettext('Monthly issues by type')}>
          <text className="connection-statistics-axis-title" transform={`translate(16, ${(HEIGHT - MARGIN.bottom + MARGIN.top) / 2}) rotate(-90)`} textAnchor="middle">
            {gettext('Quantity')}
          </text>
          {ticks.map(tick => (
            <g key={tick} className="connection-statistics-tick" transform={`translate(0, ${y(tick)})`}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} />
              <text x={MARGIN.left - 10} dy="0.35em" textAnchor="end">{tick.toLocaleString()}</text>
            </g>
          ))}
          <line className="connection-statistics-baseline" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
          {months.map((month, monthIndex) => (
            <g key={month} transform={`translate(${x(month)}, 0)`}>
              <text className="connection-statistics-month" x={x.bandwidth() / 2} y={HEIGHT - MARGIN.bottom + 24} textAnchor="middle">{month}</text>
              {series.map((item, seriesIndex) => {
                const value = item.counts[monthIndex] || 0;
                const typeName = item.issue_type || gettext('Unclassified');
                const title = `${month} / ${typeName}: ${value.toLocaleString()}`;
                return (
                  <g key={seriesIndex}>
                    <rect
                      className="connection-statistics-bar"
                      x={groupX(seriesIndex)}
                      y={y(value)}
                      width={groupX.bandwidth()}
                      height={y(0) - y(value)}
                      fill={getSeriesColor(item.issue_type)}
                      aria-label={title}
                    >
                      <title>{title}</title>
                    </rect>
                    {value > 0 && groupX.bandwidth() >= String(value).length * 7 && (
                      <text className="connection-statistics-value" x={groupX(seriesIndex) + groupX.bandwidth() / 2} y={y(value) - 6} textAnchor="middle">{value}</text>
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
