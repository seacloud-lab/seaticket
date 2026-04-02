import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import Tooltip from './tooltip';

const formatCreditUsed = (value) => {
  if (value === 0) return '0';
  const withDecimals = value.toFixed(0);
  const trimmed = withDecimals.replace(/\.?0+$/, '');
  return trimmed;
};

const TokenCreditUsed = ({
  data = [],
  modelsUsageStatics = { totalInputTokens: 0, totalOutputTokens: 0, totalCreditUsed: 0 },
  legends = [
    { key: 'input_tokens', name: gettext('Input tokens'), color: '#8884d8' },
    { key: 'output_tokens', name: gettext('Output tokens'), color: '#82ca9d' },
    { key: 'credit_used', name: gettext('Credit used'), color: '#ff7300' },
  ],
  margin = { top: 60, right: 100, left: 80, bottom: 100 },
}) => {
  const [tooltip, setTooltip] = useState({ display: false, position: { left: 0, top: 0 } });

  const [isAnnotationExpanded, setIsAnnotationExpanded] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);

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
    const creditUsedColor = legends.find(l => l.key === 'credit_used')?.color;

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
      total_tokens: Number(d.total_tokens) || 0,
      credit_used: Number(d.credit_used) || 0,
    }));

    // X
    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.2);

    // tokens Y
    const maxTokens = d3.max(chartData, d => d.total_tokens) * 1.3;
    const yLeftScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxTokens / 1000) * 1000])
      .range([innerHeight, 0]);

    const maxCreditUsed = d3.max(chartData, d => d.credit_used) * 1.3;
    let niceMaxCreditUsed;
    if (maxCreditUsed <= 0.001) {
      niceMaxCreditUsed = 0.001;
    } else if (maxCreditUsed <= 0.002) {
      niceMaxCreditUsed = 0.002;
    } else if (maxCreditUsed <= 0.005) {
      niceMaxCreditUsed = 0.005;
    } else if (maxCreditUsed <= 0.01) {
      niceMaxCreditUsed = 0.01;
    } else if (maxCreditUsed <= 0.02) {
      niceMaxCreditUsed = 0.02;
    } else if (maxCreditUsed <= 0.05) {
      niceMaxCreditUsed = 0.05;
    } else if (maxCreditUsed <= 0.1) {
      niceMaxCreditUsed = 0.1;
    } else if (maxCreditUsed <= 0.2) {
      niceMaxCreditUsed = 0.2;
    } else if (maxCreditUsed <= 0.5) {
      niceMaxCreditUsed = 0.5;
    } else {
      niceMaxCreditUsed = Math.ceil(maxCreditUsed * 2) / 2;
    }

    const yRightScale = d3.scaleLinear()
      .domain([0, niceMaxCreditUsed])
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

    // draw creditUsed axis
    svg.append('g')
      .attr('class', 'axis axis-right')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(d3.axisRight(yRightScale)
        .tickFormat(d => formatCreditUsed(d))
        .ticks(5)
      )
      .style('font-size', '11px');

    // draw creditUsed axis name
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', innerWidth + 70)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(gettext('Credit used'));

    // draw x(name)
    const xAxis = d3.axisBottom(xScale);
    if (chartData.length > 10) {
      const step = Math.ceil(chartData.length / 10);
      const tickValues = chartData
        .map((d, i) => i % step === 0 ? d.name : null)
        .filter(v => v !== null);
      xAxis.tickValues(tickValues);
    }

    svg.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .style('font-size', '11px')
      .selectAll('text')
      .attr('transform', 'rotate(15)')
      .style('text-anchor', 'start');

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

    chartData.forEach((d, i) => {
      const x = xScale(d.name) + barOffset;
      const highlightAreaWith = (barWidth * 0.2).toFixed(0);

      svg.append('rect')
        .attr('class', 'highlight-area')
        .attr('x', x - highlightAreaWith)
        .attr('y', 0)
        .attr('width', barWidth + 2 * highlightAreaWith)
        .attr('height', innerHeight)
        .attr('fill', '#757575ff')
        .attr('opacity', hoveredBar === d.name ? 0.15 : 0)
        .attr('pointer-events', 'none');
    });

    chartData.forEach((d, i) => {
      const x = xScale(d.name) + barOffset;

      svg.append('rect')
        .attr('class', 'hover-layer')
        .attr('x', x - 5)
        .attr('y', 0)
        .attr('width', barWidth + 10)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'default')
        .on('mouseenter', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setHoveredBar(d.name);
          if (d.name === tooltipData.current?.name) return;
          tooltipData.current = d;
          setTooltip({
            display: true,
            position: {
              left: event.pageX + 6,
              top: event.pageY + 6,
            }
          });
        })
        .on('mouseleave', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setHoveredBar(null);
          setTooltip({ display: false, position: { left: 0, top: 0 } });
          tooltipData.current = null;
        });
    });

    // draw tokens
    chartData.forEach((d, i) => {
      const x = xScale(d.name) + barOffset;
      const totalTokens = d.input_tokens + d.output_tokens;
      const group = svg
        .append('g')
        .attr('class', 'group')
        .attr('name', d.name)
        .on('mouseenter', function (event) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredBar(d.name);
          if (d.name === tooltipData.current?.name) return;
          tooltipData.current = d;
          setTooltip({
            display: true,
            position: {
              left: event.pageX + 6,
              top: event.pageY + 6,
            }
          });
        })
        .on('mousemove', function (event) {
          setTooltip({
            display: true,
            position: {
              left: event.pageX + 6,
              top: event.pageY + 6,
            }
          });
        })
        .on('mouseleave', function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredBar(null);
          setTooltip({ display: false, position: { left: 0, top: 0 } });
          tooltipData.current = null;
        });

      // draw input tokens
      group.append('rect')
        .attr('x', x)
        .attr('y', yLeftScale(d.input_tokens))
        .attr('width', barWidth)
        .attr('height', innerHeight - yLeftScale(d.input_tokens))
        .attr('fill', inputTokensColor);

      // draw output tokens
      group.append('rect')
        .attr('x', x)
        .attr('y', yLeftScale(totalTokens))
        .attr('width', barWidth)
        .attr('height', yLeftScale(d.input_tokens) - yLeftScale(totalTokens))
        .attr('fill', outputTokensColor);
    });

    const centerX = (d) => xScale(d.name) + xScale.bandwidth() / 2;

    // init creditUsed
    const linePoints = chartData.map(d => ({
      x: centerX(d),
      y: yRightScale(d.credit_used)
    }));

    // draw creditUsed
    const lineGenerator = d3.line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveLinear);

    const group = svg
      .append('g')
      .attr('class', 'group')
      .attr('name', 'creditUsed');

    group.append('path')
      .datum(linePoints)
      .attr('fill', 'none')
      .attr('stroke', creditUsedColor)
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator);

    // draw creditUsed dot
    group.selectAll('.creditUsed-circle')
      .data(chartData)
      .join('circle')
      .attr('class', 'creditUsed-circle')
      .attr('cx', d => centerX(d))
      .attr('cy', d => yRightScale(d.credit_used))
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('stroke', creditUsedColor)
      .attr('stroke-width', 2)
      .on('mouseenter', function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        setHoveredBar(d.name);
        if (d.name === tooltipData.current?.name) return;
        tooltipData.current = d;
        setTooltip({
          display: true,
          position: {
            left: event.pageX + 6,
            top: event.pageY + 6,
          }
        });
      })
      .on('mousemove', function (event) {
        setTooltip({
          display: true,
          position: {
            left: event.pageX + 6,
            top: event.pageY + 6,
          }
        });
      })
      .on('mouseleave', function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        setHoveredBar(null);
        setTooltip({ display: false, position: { left: 0, top: 0 } });
        tooltipData.current = null;
      });

    const annotationGroup = svg.append('g')
      .attr('class', 'total-annotation')
      .attr('transform', `translate(${innerWidth - 220}, 0)`)
      .style('cursor', 'pointer')
      .on('click', (event) => {
        event.stopPropagation();
        setIsAnnotationExpanded(!isAnnotationExpanded);
      });

    const bgHeight = isAnnotationExpanded ? 85 : 30;
    annotationGroup.append('rect')
      .attr('width', 200)
      .attr('height', bgHeight)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', 'white')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    const titleGroup = annotationGroup.append('g')
      .attr('class', 'annotation-title');

    titleGroup.append('text')
      .attr('x', 190)
      .attr('y', 18)
      .attr('font-size', '14px')
      .attr('fill', '#666')
      .attr('text-anchor', 'end')
      .attr('cursor', 'pointer')
      .text(isAnnotationExpanded ? '−' : '+');

    titleGroup.append('text')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .attr('fill', '#212529')
      .attr('fill-opacity', 0.8)
      .text(gettext('Comprehensive infomation'));

    if (isAnnotationExpanded) {
      // Input tokens
      const inputTokensTotal = modelsUsageStatics.totalInputTokens || 0;

      annotationGroup.append('rect')
        .attr('x', 10)
        .attr('y', 30)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', inputTokensColor)
        .attr('rx', 2);

      annotationGroup.append('text')
        .attr('x', 26)
        .attr('y', 40)
        .attr('font-size', '11px')
        .attr('fill', '#666')
        .text(`${gettext('Input tokens')}: ${inputTokensTotal.toLocaleString()}`);

      // Output tokens
      const outputTokensTotal = modelsUsageStatics.totalOutputTokens || 0;
      annotationGroup.append('rect')
        .attr('x', 10)
        .attr('y', 48)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', outputTokensColor)
        .attr('rx', 2);

      annotationGroup.append('text')
        .attr('x', 26)
        .attr('y', 58)
        .attr('font-size', '11px')
        .attr('fill', '#666')
        .text(`${gettext('Output tokens')}: ${outputTokensTotal.toLocaleString()}`);

      // CreditUsed
      const creditUsedTotal = modelsUsageStatics.totalCreditUsed || 0;
      annotationGroup.append('line')
        .attr('x1', 10)
        .attr('y1', 71)
        .attr('x2', 22)
        .attr('y2', 71)
        .attr('stroke', creditUsedColor)
        .attr('stroke-width', 2.5);

      annotationGroup.append('circle')
        .attr('cx', 16)
        .attr('cy', 71)
        .attr('r', 4)
        .attr('fill', creditUsedColor)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5);

      annotationGroup.append('text')
        .attr('x', 26)
        .attr('y', 75)
        .attr('font-size', '11px')
        .attr('fill', '#666')
        .text(`${gettext('Credit used')}: ${formatCreditUsed(creditUsedTotal)}`);
    }

    // draw legends
    const legendY = innerHeight + 50;
    const legendItemWidth = 120;
    const legendSpacing = 30;
    const totalLegendWidth = legends.length * legendItemWidth + (legends.length - 1) * legendSpacing;
    const legendStartX = (innerWidth - totalLegendWidth) / 2;

    legends.forEach((item, i) => {
      const legendItem = svg.append('g')
        .attr('transform', `translate(${legendStartX + i * (legendItemWidth + legendSpacing)}, ${legendY})`);

      if (item.key === 'creditUsed') {
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
        .style('fill', '#212529')
        .text(item.name);
    });

  }, [data, legends, margin, isAnnotationExpanded, hoveredBar, modelsUsageStatics]);

  return (
    <div className="sea-ai-tokens-chart w-100 h-100 d-flex align-items-center justify-content-center" ref={ref}>
      <svg ref={chartRef}></svg>
      {tooltip.display && tooltipData.current && (
        <Tooltip data={tooltipData.current} position={tooltip.position} legends={legends} />
      )}
    </div>
  );
};

export default TokenCreditUsed;
