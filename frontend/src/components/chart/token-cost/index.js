import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import Tooltip from './tooltip';

const formatCost = (value) => {
  if (value === 0) return '0';
  const withDecimals = value.toFixed(6);
  const trimmed = withDecimals.replace(/\.?0+$/, '');
  return trimmed;
};

const TokenCost = ({
  data = [],
  legends = [
    { key: 'input_tokens', name: gettext('Input tokens'), color: '#8884d8' },
    { key: 'output_tokens', name: gettext('Output tokens'), color: '#82ca9d' },
    { key: 'cost', name: gettext('Cost'), color: '#ff7300' },
  ],
  margin = { top: 60, right: 100, left: 80, bottom: 100 },
}) => {
  const [tooltip, setTooltip] = useState({ display: false, position: { left: 0, top: 0 } });

  const chartRef = useRef(null);
  const ref = useRef(null);
  const tooltipData = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const { height: containerHeight } = ref.current.getBoundingClientRect();
    const width = containerHeight * 2 - 100;
    const height = containerHeight;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const inputTokensColor = legends.find(l => l.key === 'input_tokens')?.color;
    const outputTokensColor = legends.find(l => l.key === 'output_tokens')?.color;
    const costColor = legends.find(l => l.key === 'cost')?.color;

    // init svg
    const svg = d3.select(chartRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // init data
    const chartData = data.map(d => ({
      name: d.name,
      input_tokens: Number(d.input_tokens) || 0,
      output_tokens: Number(d.output_tokens) || 0,
      cost: Number(d.cost) || 0,
      total_tokens: Number(d.total_tokens) || 0,
    }));

    // X
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.2);

    // tokens Y
    const maxTokens = d3.max(chartData, d => d.total_tokens);
    const yLeftScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxTokens / 1000) * 1000])
      .range([innerHeight, 0]);

    const maxCost = d3.max(chartData, d => d.cost);
    let niceMaxCost;
    if (maxCost <= 0.001) {
      niceMaxCost = 0.001;
    } else if (maxCost <= 0.002) {
      niceMaxCost = 0.002;
    } else if (maxCost <= 0.005) {
      niceMaxCost = 0.005;
    } else if (maxCost <= 0.01) {
      niceMaxCost = 0.01;
    } else if (maxCost <= 0.02) {
      niceMaxCost = 0.02;
    } else if (maxCost <= 0.05) {
      niceMaxCost = 0.05;
    } else if (maxCost <= 0.1) {
      niceMaxCost = 0.1;
    } else if (maxCost <= 0.2) {
      niceMaxCost = 0.2;
    } else if (maxCost <= 0.5) {
      niceMaxCost = 0.5;
    } else {
      niceMaxCost = Math.ceil(maxCost * 2) / 2;
    }

    const yRightScale = d3.scaleLinear()
      .domain([0, niceMaxCost])
      .range([innerHeight, 0]);

    // draw tokens axis
    svg.append('g')
      .attr('class', 'axis axis-left')
      .call(d3.axisLeft(yLeftScale)
        .tickFormat(d => d >= 1000 ? (d / 1000) + 'K' : d)
      )
      .style('font-size', '11px');

    // draw tokens axis name
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(gettext('Tokens'));

    // draw cost axis
    svg.append('g')
      .attr('class', 'axis axis-right')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(d3.axisRight(yRightScale)
        .tickFormat(d => formatCost(d))
        .ticks(5)
      )
      .style('font-size', '11px');

    // draw cost axis name
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', innerWidth + 70)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(gettext('Cost'));

    // draw x(name)
    svg.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .style('font-size', '11px');

    // draw x label
    svg.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(gettext('Date'));

    const barWidth = xScale.bandwidth() * 0.7;
    const barOffset = (xScale.bandwidth() - barWidth) / 2;

    // draw tokens
    chartData.forEach((d, i) => {
      const x = xScale(d.name) + barOffset;
      const totalTokens = d.input_tokens + d.output_tokens;

      // draw input tokens
      svg.append('rect')
        .attr('x', x)
        .attr('y', yLeftScale(d.input_tokens))
        .attr('width', barWidth)
        .attr('height', innerHeight - yLeftScale(d.input_tokens))
        .attr('fill', inputTokensColor)
        .attr('opacity', 0.9);

      // draw output tokens
      svg.append('rect')
        .attr('x', x)
        .attr('y', yLeftScale(totalTokens))
        .attr('width', barWidth)
        .attr('height', yLeftScale(d.input_tokens) - yLeftScale(totalTokens))
        .attr('fill', outputTokensColor)
        .attr('opacity', 0.9);
    });

    const centerX = (d) => xScale(d.name) + xScale.bandwidth() / 2;

    // init cost
    const linePoints = chartData.map(d => ({
      x: centerX(d),
      y: yRightScale(d.cost)
    }));

    // draw cost
    const lineGenerator = d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinear);

    svg.append('path')
      .datum(linePoints)
      .attr('fill', 'none')
      .attr('stroke', costColor)
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator);

    // draw cost dot
    svg.selectAll('.cost-circle')
      .data(chartData)
      .join('circle')
      .attr('class', 'cost-circle')
      .attr('cx', d => centerX(d))
      .attr('cy', d => yRightScale(d.cost))
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('stroke', costColor)
      .attr('stroke-width', 2)
      .attr('pointer-events', 'all')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        if (d.name === tooltipData.current?.name) return;
        console.log('mouseover', d.name);
        tooltipData.current = d;
        setTooltip({
          display: true,
          position: {
            left: event.pageX + 2,
            top: event.pageY + 2,
          }
        });
      })
      .on('mouseout', function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        setTooltip({ display: false, position: { left: 0, top: 0 } });
        tooltipData.current = null;
      });

    // draw legends
    const legendY = innerHeight + 50;
    const legendItemWidth = 120;
    const legendSpacing = 30;
    const totalLegendWidth = legends.length * legendItemWidth + (legends.length - 1) * legendSpacing;
    const legendStartX = (innerWidth - totalLegendWidth) / 2;

    legends.forEach((item, i) => {
      const legendItem = svg.append('g')
        .attr('transform', `translate(${legendStartX + i * (legendItemWidth + legendSpacing)}, ${legendY})`);

      if (item.key === 'cost') {
        legendItem.append('line')
          .attr('x1', 0)
          .attr('y1', 9)
          .attr('x2', 20)
          .attr('y2', 9)
          .attr('stroke', item.color)
          .attr('stroke-width', 2.5);

        legendItem.append('circle')
          .attr('cx', 10)
          .attr('cy', 9)
          .attr('r', 5)
          .attr('fill', item.color)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else {
        legendItem.append('rect')
          .attr('width', 20)
          .attr('height', 18)
          .attr('fill', item.color)
          .attr('rx', 3);
      }

      legendItem.append('text')
        .attr('x', 25)
        .attr('y', 14)
        .style('font-size', '12px')
        .style('fill', '#333')
        .text(item.name);
    });

  }, [data, legends, margin]);

  return (
    <div className="sea-ai-tokens-chart w-100 h-100 d-flex align-items-center justify-content-center" ref={ref}>
      <svg ref={chartRef}></svg>
      {tooltip.display && tooltipData.current && (
        <Tooltip data={tooltipData.current} position={tooltip.position} legends={legends} />
      )}
    </div>
  );
};

export default TokenCost;
