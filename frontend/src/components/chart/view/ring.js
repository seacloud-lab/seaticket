import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { initChart, destroyChart } from '../utils';
import { STYLE_COLORS, DEFAULT_LABEL_FONT_SIZE, DEFAULT_LABEL_COLOR } from '../constants';
import ToolTip from '../components/tooltip';

import './index.css';

const Ring = ({ data }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [toolTipPosition, setToolTipPosition] = useState(null);
  const ref = useRef(null);
  const chartRef = useRef(null);

  const showTooltip = (event, data, colorScale) => {
    const { offsetX, offsetY } = event;
    const newTooltipData = {
      title: false,
      items: [
        {
          color: colorScale(data.name),
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

    // Color
    const colorDomain = new Set(data.map(d => d.name));
    const colorRange = STYLE_COLORS[0].colors;
    const color = d3.scaleOrdinal()
      .domain(colorDomain)
      .range(colorRange);

    // Ring and Arc
    const pie = d3.pie()
      .sort(null)
      .padAngle(0)
      .value(d => d.value);

    const arcs = pie(data);
    const arc = d3.arc()
      .innerRadius(Math.min(chartWidth, chartHeight) / 2 * 0.99)
      .outerRadius(Math.min(chartWidth, chartHeight) / 2 * 0.6);

    // Draw Ring
    chart.append('g')
      .attr('class', 'content-wrapper')
      .selectAll()
      .data(arcs)
      .join('path')
      .attr('opacity', 1)
      .attr('fill', d => color(d.data.name))
      .attr('d', arc)
      .attr('data-groupName', d => d.data.name)
      .call(g => {
        const { width, height } = g.node().parentNode?.getBoundingClientRect() || { width: 0, height: 0 };
        const left = width / 2 + insertPadding;
        const top = height / 2 + insertPadding;
        const offsetX = ((chartWidth - insertPadding - insertPadding) - width) / 2;
        const offsetY = ((chartHeight - insertPadding - insertPadding) - height) / 2;
        d3.select(g.node().parentNode).attr('transform', `translate(${left + offsetX}, ${top + offsetY})`);

        // Draw label
        const labelRadius = arc.outerRadius()() * 1.3;
        const arcLabel = d3.arc()
          .innerRadius(labelRadius)
          .outerRadius(labelRadius);

        chart.append('g')
          .attr('class', 'label-wrapper')
          .attr('transform', `translate(${left + offsetX}, ${top + offsetY})`)
          .attr('text-anchor', 'middle')
          .selectAll()
          .data(arcs)
          .join('text')
          .attr('class', 'label')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .attr('paint-order', 'stroke')
          .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
          .text((d) => {
            const { percentage } = d.data;
            return percentage;
          })
          .attr('fill', DEFAULT_LABEL_COLOR)
          .attr('font-size', DEFAULT_LABEL_FONT_SIZE);
      })
      .on('mouseenter', (event, rowData) => {
        showTooltip(event, rowData.data, color);
      })
      .on('mousemove', (event) => {
        moveTooltip(event);
      })
      .on('mouseleave', (event, data) => {
        if (event.relatedTarget.getAttribute('class') === 'label') return;
        hiddenTooltip();
      });
  };

  useEffect(() => {
    const initConfig = { insertPadding: 30 };
    initChart(ref, chartRef, 'ring', initConfig);

    return () => {
      destroyChart(chartRef);
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!chartRef.current || !ref.current) return;

    drawChart(chartRef.current, ref.current, data);
  }, [data]);

  return (
    <div className="chart-svg-wrapper flex-1" ref={ref}>
      <ToolTip tooltipData={tooltipData} toolTipPosition={toolTipPosition} chart={chartRef.current} />
    </div>
  );
};

export default Ring;
