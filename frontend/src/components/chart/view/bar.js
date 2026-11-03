import React, { useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import ChartTooltip from '../chart-tooltip';
import { STYLE_COLORS, CHART_THEME_COLOR } from '../constants';
import { drawYaxis, addClipPath, checkTickOverlap } from '../utils';
import useChartDraw from './use-chart-redraw';

import './index.css';

const DEFAULT_OPTIONS = {};

// Grouped categories use { name, values: [{ name, value, color }] }; flat entries stay supported.
const Bar = ({ data, options = DEFAULT_OPTIONS, ariaLabel }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [toolTipPosition, setToolTipPosition] = useState(null);
  const ref = useRef(null);
  const chartId = useId().replace(/:/g, '');
  const rows = useMemo(() => data.map(item => ({
    ...item,
    values: item.values || [item],
  })), [data]);
  const isGrouped = data.some(item => Array.isArray(item.values));
  const seriesCount = d3.max(rows, row => row.values.length) || 1;
  const initOptions = useMemo(() => ({
    insertPadding: 20,
    borderRadius: 0.2,
    minWidth: options.minCategoryWidth
      ? 40 + data.length * Math.max(options.minCategoryWidth, isGrouped ? seriesCount * 20 + 8 : 0)
      : 0,
  }), [data.length, isGrouped, options, seriesCount]);

  const showTooltip = (event, item) => {
    const [offsetX, offsetY] = d3.pointer(event, ref.current.querySelector('svg'));
    const newTooltipData = {
      title: isGrouped ? item.category : gettext('Amount'),
      items: [
        {
          color: item.color || STYLE_COLORS[0].colors[0],
          name: item.name,
          value: item.value
        }
      ]
    };
    setTooltipData(newTooltipData);
    setToolTipPosition({ offsetX, offsetY });
  };

  const moveTooltip = (event) => {
    const [offsetX, offsetY] = d3.pointer(event, ref.current.querySelector('svg'));
    setToolTipPosition({ offsetX, offsetY });
  };

  const hiddenTooltip = () => {
    setToolTipPosition(null);
  };

  const drawChart = (chart, container, data = []) => {
    const { width: chartWidth, height: chartHeight, insertPadding } = container.chartBoundingClientRect;
    const theme = CHART_THEME_COLOR;
    const bottom = options.labelRotation ? 62 : options.showValues ? 36 : insertPadding;
    const top = options.showValues ? 28 : insertPadding;
    const maxValue = d3.max(data, row => d3.max(row.values, item => item.value)) || 0;

    const y = d3.scaleLinear()
      .domain([0, maxValue > 0 ? maxValue : 1])
      .range([chartHeight - bottom, top]);
    if (options.integerTicks) y.nice(5);

    chart.attr('role', 'img').attr('aria-label', ariaLabel || gettext('Amount'));

    // Y axis
    chart.append('g')
      .attr('class', 'y-axis-wrapper')
      .attr('transform', `translate(${insertPadding}, 0)`)
      .call(d3.axisLeft(y).tickSizeInner(0).ticks(5)
        .tickValues(options.integerTicks ? y.ticks(5).filter(Number.isInteger) : null)
        .tickFormat(value => value.toLocaleString()))
      .call(g => drawYaxis(g, theme, 0, container));

    const x = d3.scaleBand()
      .domain(data.map(item => item.name))
      .range([insertPadding + container.horizontalOverflowOffset, chartWidth - (options.labelRotation ? 32 : insertPadding)])
      .paddingInner(isGrouped ? 0.16 : 0.5)
      .paddingOuter(isGrouped ? 0.12 : 0.1);
    const groupX = d3.scaleBand()
      .domain(d3.range(seriesCount))
      .range([0, x.bandwidth()])
      .padding(isGrouped ? 0.08 : 0);

    // X axis
    chart.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('transform', `translate(0, ${chartHeight - bottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0).tickSizeInner(5))
      .call(g => {
        g.selectAll('.domain').attr('stroke', theme.XAxisColor);
        g.selectAll('.tick line').attr('stroke', theme.XAxisColor);
        g.selectAll('text').attr('font-size', theme.fontSize);
        g.selectAll('text').attr('fill', theme.textColor);

        if (options.labelRotation) {
          g.selectAll('text')
            .attr('transform', `rotate(${options.labelRotation})`)
            .attr('text-anchor', 'start')
            .attr('dx', '0.5em');
        } else {
          checkTickOverlap(g, 'xAxis', chart, container.chartBoundingClientRect);
        }
      });

    const barWidth = Math.min(groupX.bandwidth(), options.maxBarWidth || Infinity);
    const bars = data.flatMap(row => row.values.map((item, index) => ({
      ...item,
      category: row.name,
      x: x(row.name) + groupX(index) + (groupX.bandwidth() - barWidth) / 2,
    })));
    const contentWrapper = chart.append('g').attr('class', 'content-wrapper');
    contentWrapper
      .selectAll()
      .data(bars)
      .join('rect')
      .attr('opacity', 1)
      .attr('fill', d => d.color || STYLE_COLORS[0].colors[0])
      .attr('data-x', d => d.x)
      .attr('data-y', (d) => y(d.value))
      .attr('data-width', barWidth)
      .attr('data-value', (d) => d.value)
      .attr('data-groupName', (d) => d.name)
      .attr('data-slugid', (d, index) => `${chartId}-${index}`)
      .attr('aria-label', d => `${d.category}${isGrouped ? ` / ${d.name}` : ''}: ${d.value.toLocaleString()}`)
      .attr('x', d => d.x)
      .attr('y', d => y(d.value))
      .attr('width', barWidth)
      .attr('height', d => y(0) - y(d.value))
      .call(g => {
        g.nodes().forEach(path => {
          // add rect borderRadius
          addClipPath({
            rect: path,
            parentNode: path.parentNode,
            rectId: path.getAttribute('data-slugid'),
            chartBoundingClientRect: container.chartBoundingClientRect
          });
        });
      })
      .on('mouseover', (event, data) => {
        showTooltip(event, data);
      })
      .on('mousemove', (event) => {
        moveTooltip(event);
      })
      .on('mouseleave', (event) => {
        hiddenTooltip(event);
      })
      .append('title')
      .text(d => `${d.category}${isGrouped ? ` / ${d.name}` : ''}: ${d.value.toLocaleString()}`);

    if (options.showValues) {
      contentWrapper.selectAll('.chart-value')
        .data(bars.filter(item => item.value > 0 && groupX.bandwidth() >= item.value.toLocaleString().length * 7))
        .join('text')
        .attr('class', 'chart-value')
        .attr('x', d => d.x + barWidth / 2)
        .attr('y', d => y(d.value) - 8)
        .attr('text-anchor', 'middle')
        .text(d => d.value.toLocaleString());
    }
  };

  const chart = useChartDraw({
    target: ref,
    data: rows,
    chartId: `bar-${chartId}`,
    options: initOptions,
    draw: drawChart,
  });

  return (
    <div className="chart-bar-scroll flex-1">
      <div className="chart-svg-wrapper chart-bar" ref={ref} style={options.height ? { height: options.height } : undefined}>
        <ChartTooltip tooltipData={tooltipData} toolTipPosition={toolTipPosition} chart={chart} />
      </div>
    </div>
  );
};

export default Bar;
