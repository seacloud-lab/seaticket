import React, { useMemo, useRef } from 'react';
import classnames from 'classnames';
import * as d3 from 'd3';
import { STYLE_COLORS, DEFAULT_LABEL_FONT_SIZE, DEFAULT_LABEL_COLOR } from '../constants';
import { resolveSideOverlap } from '../utils';
import useChartDraw from './use-chart-redraw';

import './index.css';

const Ring = ({ data, variant = 'ring', ariaLabel }) => {
  const ref = useRef(null);
  const options = useMemo(() => ({ insertPadding: variant === 'pie' ? 0 : 30 }), [variant]);

  const drawChart = (chart, container, data = []) => {
    const { width: chartWidth, height: chartHeight, insertPadding } = container.chartBoundingClientRect;
    const isPie = variant === 'pie';
    const total = d3.sum(data, item => Math.max(0, item.value));
    const radius = Math.min(chartWidth, chartHeight) / 2;
    chart.attr('role', 'img').attr('aria-label', ariaLabel);

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

    const arcs = pie(data.filter(item => item.value > 0));
    const arc = d3.arc()
      .innerRadius(isPie ? 0 : radius * 0.65)
      .outerRadius(radius * (isPie ? 0.88 : 0.45));

    if (arcs.length === 0) {
      if (isPie) {
        chart.append('circle')
          .attr('class', 'chart-pie-empty')
          .attr('cx', chartWidth / 2)
          .attr('cy', chartHeight / 2)
          .attr('r', radius * 0.88);
      }
      return;
    }

    // Draw Ring
    chart.append('g')
      .attr('class', 'content-wrapper')
      .selectAll()
      .data(arcs)
      .join('path')
      .attr('opacity', 1)
      .attr('class', isPie ? 'chart-slice' : null)
      .attr('fill', d => d.data.color || color(d.data.name))
      .attr('d', arc)
      .attr('data-groupName', d => d.data.name)
      .attr('aria-label', d => `${d.data.name}: ${d.data.value.toLocaleString()} (${(d.data.value / total * 100).toFixed(1)}%)`)
      .call(g => {
        g.append('title')
          .text(d => `${d.data.name}: ${d.data.value.toLocaleString()} (${(d.data.value / total * 100).toFixed(1)}%)`);
        if (isPie) {
          d3.select(g.node().parentNode).attr('transform', `translate(${chartWidth / 2}, ${chartHeight / 2})`);
          const labelRadius = radius * 0.88 * 0.58;
          const labelPosition = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);
          const labelBounds = [];
          const labels = arcs.map(item => {
            const text = `${(item.data.value / total * 100).toFixed(1)}%`;
            const [x, y] = labelPosition.centroid(item);
            const halfWidth = text.length * 4 + 2;
            const bounds = { left: x - halfWidth, right: x + halfWidth, top: y - 10, bottom: y + 10 };
            const showLabel = item.endAngle - item.startAngle >= 0.2 && !labelBounds.some(other =>
              bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top
            );
            if (showLabel) labelBounds.push(bounds);
            return { text, x, y, showLabel };
          });
          d3.select(g.node().parentNode).selectAll('.chart-percentage')
            .data(labels.filter(item => item.showLabel))
            .join('text')
            .attr('class', 'chart-percentage')
            .attr('x', item => item.x)
            .attr('y', item => item.y)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .text(item => item.text);
          return;
        }
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

  useChartDraw({
    target: ref,
    data,
    chartId: 'ring',
    options,
    draw: drawChart,
  });

  return (
    <div className={classnames('chart-svg-wrapper flex-1', { 'chart-pie': variant === 'pie' })} ref={ref}></div>
  );
};

export default Ring;
