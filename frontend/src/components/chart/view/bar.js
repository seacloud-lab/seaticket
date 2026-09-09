import React, { useRef, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import ChartTooltip from '../chart-tooltip';
import { STYLE_COLORS, CHART_THEME_COLOR } from '../constants';
import { drawYaxis, addClipPath, checkTickOverlap } from '../utils';
import useChartDraw from './use-chart-redraw';

import './index.css';

const Bar = ({ data }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [toolTipPosition, setToolTipPosition] = useState(null);
  const ref = useRef(null);

  const showTooltip = (event, data, color) => {
    const { offsetX, offsetY } = event;
    const newTooltipData = {
      title: gettext('Amount'),
      items: [
        {
          color,
          name: data.name,
          value: data.value
        }
      ]
    };
    setTooltipData(newTooltipData);
    setToolTipPosition({ offsetX, offsetY });
  };

  const moveTooltip = (event) => {
    const { offsetX, offsetY } = event;
    setToolTipPosition({ offsetX, offsetY });
  };

  const hiddenTooltip = (event) => {
    setToolTipPosition(null);
  };

  const drawChart = (chart, container, data = []) => {
    const { width: chartWidth, height: chartHeight, insertPadding } = container.chartBoundingClientRect;
    const theme = CHART_THEME_COLOR;

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.value)])
      .range([chartHeight - insertPadding, insertPadding]);

    // Y axis
    chart.append('g')
      .attr('class', 'y-axis-wrapper')
      .attr('transform', `translate(${insertPadding}, 0)`)
      .call(d3.axisLeft(y).tickSizeInner(0).ticks(5).tickFormat((d) => d))
      .call(g => drawYaxis(g, theme, 0, container));

    const x = d3.scaleBand()
      .domain(data.map(item => item.name))
      .range([insertPadding + container.horizontalOverflowOffset, chartWidth - insertPadding])
      .paddingInner(0.5)
      .paddingOuter(0.1);

    // X axis
    chart.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('transform', `translate(0, ${chartHeight - insertPadding})`)
      .call(d3.axisBottom(x).tickSizeOuter(0).tickSizeInner(5))
      .call(g => {
        g.selectAll('.domain').attr('stroke', theme.XAxisColor);
        g.selectAll('.tick line').attr('stroke', theme.XAxisColor);
        g.selectAll('text').attr('font-size', theme.fontSize);
        g.selectAll('text').attr('fill', theme.textColor);

        checkTickOverlap(g, 'xAxis', chart, container.chartBoundingClientRect);
      });

    const contentWrapper = chart.append('g').attr('class', 'content-wrapper');
    contentWrapper
      .selectAll()
      .data(data)
      .join('rect')
      .attr('opacity', 1)
      .attr('fill', () => STYLE_COLORS[0].colors[0])
      .attr('data-x', (d) => x(d.name))
      .attr('data-y', (d) => y(d.value))
      .attr('data-width', x.bandwidth())
      .attr('data-value', (d) => d.value)
      .attr('data-groupName', (d) => d.name)
      .attr('data-slugid', (d) => d.name)
      .attr('x', (d) => x(d.name))
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
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
        const barColor = event.currentTarget?.getAttribute('fill') || STYLE_COLORS[0].colors[0];
        showTooltip(event, data, barColor);
      })
      .on('mousemove', (event) => {
        moveTooltip(event);
      })
      .on('mouseleave', (event) => {
        hiddenTooltip(event);
      });
  };

  const chart = useChartDraw({
    target: ref,
    data,
    chartId: 'bar',
    options: { insertPadding: 20, borderRadius: 0.2 },
    draw: drawChart,
  });

  return (
    <div className="chart-svg-wrapper flex-1" ref={ref}>
      <ChartTooltip tooltipData={tooltipData} toolTipPosition={toolTipPosition} chart={chart} />
    </div>
  );
};

export default Bar;
