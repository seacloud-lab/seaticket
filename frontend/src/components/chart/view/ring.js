import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { initChart, destroyChart, resolveSideOverlap } from '../utils';
import { STYLE_COLORS, DEFAULT_LABEL_FONT_SIZE, DEFAULT_LABEL_COLOR } from '../constants';

import './index.css';

const Ring = ({ data }) => {
  const ref = useRef(null);
  const chartRef = useRef(null);

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
      .innerRadius(Math.min(chartWidth, chartHeight) / 2 * 0.65)
      .outerRadius(Math.min(chartWidth, chartHeight) / 2 * 0.45);

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

        const centerTranslate = `translate(${left + offsetX}, ${top + offsetY})`;
        const labelRadius = arc.outerRadius()() * 2.15;
        const lineRadius = arc.innerRadius()();
        const minLabelGap = DEFAULT_LABEL_FONT_SIZE + 4;
        const maxLabelY = labelRadius * 0.95;

        const labelItems = arcs.map((d) => {
          const midAngle = (d.startAngle + d.endAngle) / 2;
          const cosVal = Math.cos(midAngle - Math.PI / 2);
          const sinVal = Math.sin(midAngle - Math.PI / 2);
          const side = cosVal >= 0 ? 1 : -1;

          return {
            data: d,
            side,
            startX: cosVal * lineRadius,
            startY: sinVal * lineRadius,
            elbowX: side * (labelRadius * 0.86),
            labelX: side * (labelRadius + 8),
            labelY: sinVal * labelRadius,
          };
        });

        resolveSideOverlap(labelItems.filter(item => item.side > 0), minLabelGap, maxLabelY);
        resolveSideOverlap(labelItems.filter(item => item.side < 0), minLabelGap, maxLabelY);

        chart.append('g')
          .attr('class', 'label-line-wrapper')
          .attr('transform', centerTranslate)
          .selectAll()
          .data(labelItems)
          .join('polyline')
          .attr('fill', 'none')
          .attr('stroke', DEFAULT_LABEL_COLOR)
          .attr('stroke-dasharray', '4,2')
          .attr('points', (item) => {
            const endX = item.labelX - item.side * 4;
            return `${item.startX},${item.startY} ${item.elbowX},${item.labelY} ${endX},${item.labelY}`;
          });

        chart.append('g')
          .attr('class', 'label-wrapper')
          .attr('transform', centerTranslate)
          .selectAll()
          .data(labelItems)
          .join('text')
          .attr('class', 'label')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .attr('paint-order', 'stroke')
          .attr('x', item => item.labelX)
          .attr('y', item => item.labelY)
          .attr('dy', '0.32em')
          .attr('text-anchor', item => item.side > 0 ? 'start' : 'end')
          .text((item) => {
            const { name, percentage } = item.data.data;
            return `${name} ${percentage}`;
          })
          .attr('fill', DEFAULT_LABEL_COLOR)
          .attr('font-size', DEFAULT_LABEL_FONT_SIZE);
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
    <div className="chart-svg-wrapper flex-1" ref={ref}></div>
  );
};

export default Ring;
