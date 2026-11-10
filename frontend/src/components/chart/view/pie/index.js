import React, { useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { CHART_THEME_COLOR, STYLE_COLORS } from '../../constants';
import useChartDraw from '../use-chart-redraw';

import './index.css';

const EMPTY_DATA = [];
const PIE_ANIMATION_DURATION = 450;
const LEGEND_ITEM_HEIGHT = 24;
const LEGEND_ITEM_MARGIN = 5;
const LEGEND_RECT_WIDTH = 20;
const LEGEND_RECT_HEIGHT = 6;
const LEGEND_TEXT_GAP = 8;
const CHART_PADDING = 16;
const CHART_LEGEND_GAP = 24;
const MIN_PLOT_WIDTH = 140;
const LEGEND_NAV_HEIGHT = 20;

const DEFAULT_LABEL_FORMATTER = (_item, percentage) => `${percentage.toFixed(1)}%`;

const getSvgTextWidth = (textNode) => {
  if (!textNode) return 0;
  if (typeof textNode.getComputedTextLength === 'function') {
    const width = textNode.getComputedTextLength();
    if (width > 0) return width;
  }
  return (textNode.textContent || '').length * CHART_THEME_COLOR.legendFontSize * 0.6;
};

const truncateLegendText = (textNode, maxWidth) => {
  if (!textNode || !Number.isFinite(maxWidth)) return false;

  const fullText = textNode.textContent || '';
  if (!fullText || getSvgTextWidth(textNode) <= maxWidth) return false;

  let length = fullText.length;
  while (length > 0) {
    textNode.textContent = `${fullText.slice(0, length)}...`;
    if (getSvgTextWidth(textNode) <= maxWidth) return true;
    length--;
  }

  textNode.textContent = '...';
  return true;
};

const animateArcGrowIn = (selection, arc, duration = PIE_ANIMATION_DURATION) => {
  if (!selection || selection.empty()) return;
  selection.each(function (datum) {
    const path = d3.select(this);
    const interpolate = d3.interpolate(
      { startAngle: datum.startAngle, endAngle: datum.startAngle, padAngle: datum.padAngle },
      { startAngle: datum.startAngle, endAngle: datum.endAngle, padAngle: datum.padAngle }
    );
    path
      .attr('d', arc(interpolate(0)))
      .transition('pie-enter')
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attrTween('d', () => progress => arc(interpolate(progress)));
  });
};

const animateFadeIn = (selection, duration = PIE_ANIMATION_DURATION, delay = 0) => {
  if (!selection || selection.empty()) return;
  selection.each(function () {
    const element = d3.select(this);
    const originalOpacity = this.getAttribute('opacity');
    const targetOpacity = originalOpacity == null ? 1 : Number(originalOpacity);
    if (!(targetOpacity > 0)) return;
    element
      .attr('opacity', 0)
      .transition('pie-enter')
      .duration(duration)
      .delay(delay)
      .ease(d3.easeLinear)
      .attr('opacity', targetOpacity);
  });
};

const Pie = ({
  data = EMPTY_DATA,
  ariaLabel,
  isShowLegend = true,
  labelFormatter,
  labelPosition = 'inside',
  theme = 'theme0',
}) => {
  const ref = useRef(null);
  const hiddenLegendGroups = useRef(new Set());
  const pieRedraw = useRef(null);

  const chartData = useMemo(() => {
    const palette = STYLE_COLORS.find(item => item.name === theme)?.colors || STYLE_COLORS[0].colors;
    const colorByName = new Map();
    let colorIndex = 0;

    return (Array.isArray(data) ? data : []).map((item) => {
      const source = item || {};
      const name = String(source.name ?? '');
      const parsedValue = Number(source.value);
      const value = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;

      if (!colorByName.has(name)) {
        colorByName.set(name, source.color || palette[colorIndex % palette.length]);
        colorIndex++;
      }

      return {
        ...source,
        name,
        value,
        color: source.color || colorByName.get(name),
      };
    });
  }, [data, theme]);

  const formattedLabel = typeof labelFormatter === 'function'
    ? labelFormatter
    : DEFAULT_LABEL_FORMATTER;
  const options = useMemo(() => ({
    insertPadding: 0,
    isShowLegend,
    labelFormatter: formattedLabel,
    labelPosition,
  }), [formattedLabel, isShowLegend, labelPosition]);

  const toggleLegendGroup = (groupName, legendNames) => {
    const hiddenGroups = hiddenLegendGroups.current;
    if (hiddenGroups.has(groupName)) {
      hiddenGroups.delete(groupName);
      return false;
    }
    if (legendNames.length - hiddenGroups.size > 1) {
      hiddenGroups.add(groupName);
      return true;
    }
    return null;
  };

  const drawLegend = (chart, legendData, colorScale, layout, chartHeight) => {
    const { legendX, maxTextWidth } = layout;
    const availableHeight = Math.max(LEGEND_ITEM_HEIGHT, chartHeight - CHART_PADDING * 2);
    const maxItems = Math.max(1, Math.floor(availableHeight / (LEGEND_ITEM_HEIGHT + LEGEND_ITEM_MARGIN)));
    const hasPagination = legendData.length > maxItems;
    const pageSize = hasPagination
      ? Math.max(1, Math.floor((availableHeight - LEGEND_NAV_HEIGHT) / (LEGEND_ITEM_HEIGHT + LEGEND_ITEM_MARGIN)))
      : maxItems;
    const pageCount = Math.ceil(legendData.length / pageSize);
    const legendWrapper = chart.append('g').attr('class', 'legend-wrapper');
    const hiddenGroups = hiddenLegendGroups.current;
    let currentPage = 0;
    let pageNavigator = null;

    const updateNavigation = () => {
      if (!pageNavigator) return;
      pageNavigator.select('.legend-count').text(`${currentPage + 1}/${pageCount}`);
      pageNavigator.select('.legend-prev-page').attr('opacity', currentPage === 0 ? 0.45 : 1);
      pageNavigator.select('.legend-next-page').attr('opacity', currentPage === pageCount - 1 ? 0.45 : 1);
    };

    const renderPage = () => {
      legendWrapper.selectAll('.legend-item').remove();
      const pageData = legendData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
      const rowHeight = LEGEND_ITEM_HEIGHT + LEGEND_ITEM_MARGIN;
      const visibleRowCount = hasPagination ? pageSize : pageData.length;
      const listHeight = visibleRowCount > 0 ? visibleRowCount * rowHeight - LEGEND_ITEM_MARGIN : 0;
      const blockHeight = listHeight + (hasPagination ? LEGEND_NAV_HEIGHT + LEGEND_ITEM_MARGIN : 0);
      const startY = Math.max(0, (chartHeight - blockHeight) / 2);

      pageData.forEach((item, index) => {
        const group = legendWrapper.append('g')
          .attr('class', 'legend-item')
          .attr('data-groupName', item.name)
          .attr('opacity', hiddenGroups.has(item.name) ? 0.35 : 1)
          .style('cursor', 'pointer')
          .on('click', function () {
            const isHidden = toggleLegendGroup(item.name, legendData.map(entry => entry.name));
            if (isHidden == null) return;
            d3.select(this).attr('opacity', isHidden ? 0.35 : 1);
            pieRedraw.current && pieRedraw.current();
          });

        group.append('rect')
          .attr('width', LEGEND_RECT_WIDTH)
          .attr('height', LEGEND_RECT_HEIGHT)
          .attr('y', 5)
          .attr('rx', 3)
          .attr('fill', colorScale(item.name));

        const text = group.append('text')
          .attr('x', LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP)
          .attr('y', 13)
          .attr('fill', CHART_THEME_COLOR.legendTextColor)
          .attr('font-size', CHART_THEME_COLOR.legendFontSize)
          .text(item.name)
          .node();

        if (truncateLegendText(text, maxTextWidth)) {
          d3.select(text).append('title').text(item.name);
        }
        const itemX = legendX;
        group.attr('transform', `translate(${itemX}, ${startY + index * rowHeight})`);
      });

      if (pageNavigator) {
        pageNavigator.attr('transform', `translate(${legendX}, ${startY + listHeight + LEGEND_ITEM_MARGIN})`);
        updateNavigation();
      }
      animateFadeIn(legendWrapper.selectAll('.legend-item'));
    };

    if (hasPagination) {
      pageNavigator = legendWrapper.append('g')
        .attr('class', 'legend-flip-page');

      pageNavigator.append('text')
        .attr('class', 'legend-count')
        .attr('x', 23)
        .attr('y', 13)
        .attr('text-anchor', 'middle')
        .attr('fill', CHART_THEME_COLOR.legendTextColor)
        .attr('font-size', CHART_THEME_COLOR.legendFontSize);

      pageNavigator.append('polygon')
        .attr('class', 'legend-prev-page')
        .attr('points', '0,7 8,1 8,13')
        .attr('fill', CHART_THEME_COLOR.legendPageNavigatorMarkerColor)
        .style('cursor', 'pointer')
        .on('click', () => {
          if (currentPage > 0) {
            currentPage--;
            renderPage();
          }
        });

      pageNavigator.append('polygon')
        .attr('class', 'legend-next-page')
        .attr('points', '58,1 66,7 58,13')
        .attr('fill', CHART_THEME_COLOR.legendPageNavigatorMarkerColor)
        .style('cursor', 'pointer')
        .on('click', () => {
          if (currentPage < pageCount - 1) {
            currentPage++;
            renderPage();
          }
        });
    }

    renderPage();
  };

  const drawPie = (chart, data, colorScale, geometry, total) => {
    chart.selectAll('.content-wrapper, .pie-label-wrapper, .seaqa-chart-pie-empty').remove();

    const hiddenGroups = hiddenLegendGroups.current;
    const visibleData = data.filter(item => !hiddenGroups.has(item.name));
    const pieData = visibleData.length > 0 ? visibleData : data;
    const pie = d3.pie()
      .sort(null)
      .value(item => item.value);
    const arcs = pie(pieData.filter(item => item.value > 0));
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(geometry.radius);

    if (arcs.length === 0) {
      chart.append('circle')
        .attr('class', 'seaqa-chart-pie-empty')
        .attr('cx', geometry.centerX)
        .attr('cy', geometry.centerY)
        .attr('r', geometry.radius);
      return;
    }

    const pieGroup = chart.append('g')
      .attr('class', 'content-wrapper')
      .attr('stroke', 'white')
      .attr('transform', `translate(${geometry.centerX}, ${geometry.centerY})`);
    const slices = pieGroup.selectAll('.seaqa-chart-pie-slice')
      .data(arcs)
      .join('path')
      .attr('class', 'seaqa-chart-pie-slice')
      .attr('stroke-width', 2)
      .attr('fill', item => colorScale(item.data.name))
      .attr('data-groupName', item => item.data.name)
      .attr('aria-label', item => `${item.data.name}: ${item.data.value.toLocaleString()} (${(item.data.value / total * 100).toFixed(1)}%)`)
      .call(selection => {
        selection.append('title')
          .text(item => `${item.data.name}: ${item.data.value.toLocaleString()} (${(item.data.value / total * 100).toFixed(1)}%)`);
        animateArcGrowIn(selection, arc);
      });

    if (labelPosition === 'inside') {
      const labelRadius = arc.outerRadius()() * 0.7;
      const labelArc = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);
      const labelBounds = [];
      const labelData = arcs.map((item) => {
        const percentage = total ? item.data.value / total * 100 : 0;
        const label = formattedLabel(item.data, percentage, total);
        const text = label == null ? '' : String(label);
        const [x, y] = labelArc.centroid(item);
        const halfWidth = text.length * 4 + 2;
        const bounds = { left: x - halfWidth, right: x + halfWidth, top: y - 10, bottom: y + 10 };
        const showLabel = Boolean(text) && item.endAngle - item.startAngle >= 0.2 && !labelBounds.some(other =>
          bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top
        );
        if (showLabel) labelBounds.push(bounds);
        return { item, text, x, y, showLabel };
      });
      const labels = chart.append('g')
        .attr('class', 'pie-label-wrapper')
        .attr('transform', `translate(${geometry.centerX}, ${geometry.centerY})`)
        .attr('text-anchor', 'middle')
        .selectAll('.seaqa-chart-pie-percentage')
        .data(labelData.filter(item => item.showLabel))
        .join('text')
        .attr('class', 'seaqa-chart-pie-percentage')
        .attr('data-groupName', item => item.item.data.name)
        .attr('dominant-baseline', 'central')
        .attr('stroke-width', 1)
        .attr('paint-order', 'stroke')
        .attr('transform', item => `translate(${item.x}, ${item.y})`)
        .text(item => item.text)
        .attr('fill', '#666')
        .attr('stroke', '#fff')
        .attr('font-size', CHART_THEME_COLOR.fontSize);
      animateFadeIn(labels);
    }

    slices
      .on('mouseover', function () {
        d3.select(this.parentNode).selectAll('.seaqa-chart-pie-slice').attr('opacity', 0.35);
        d3.select(this).attr('opacity', 1);
      })
      .on('mouseleave', function () {
        d3.select(this.parentNode).selectAll('.seaqa-chart-pie-slice').attr('opacity', 1);
      });
  };

  const drawChart = (chart, container, data = []) => {
    const { width: chartWidth, height: chartHeight } = container.chartBoundingClientRect;
    const allNames = Array.from(new Set(data.map(item => item.name)));
    const validNames = new Set(allNames);
    hiddenLegendGroups.current.forEach(name => {
      if (!validNames.has(name)) hiddenLegendGroups.current.delete(name);
    });

    const legendData = allNames.map(name => data.find(item => item.name === name));
    const showLegend = isShowLegend && legendData.length > 0;
    const padding = showLegend ? CHART_PADDING : 0;
    const measureText = (value) => {
      const node = chart.append('text')
        .attr('font-size', CHART_THEME_COLOR.legendFontSize)
        .text(value)
        .node();
      const width = getSvgTextWidth(node);
      node.remove();
      return width;
    };
    const maxTextWidth = legendData.reduce((maxWidth, item) => Math.max(maxWidth, measureText(item.name)), 0);
    const desiredLegendSpace = LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP + maxTextWidth;
    const minLegendSpace = LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP + measureText('...');
    const maxLegendSpace = Math.max(0, chartWidth - padding * 2 - MIN_PLOT_WIDTH - CHART_LEGEND_GAP);
    const legendWidth = showLegend
      ? Math.min(desiredLegendSpace, Math.max(minLegendSpace, maxLegendSpace))
      : 0;
    const legendGap = showLegend ? CHART_LEGEND_GAP : 0;
    const plotWidth = Math.max(0, chartWidth - padding * 2 - legendWidth - legendGap);
    const centerX = showLegend ? padding + plotWidth / 2 : chartWidth / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(showLegend ? plotWidth : chartWidth, chartHeight) / 2 * 0.7;
    const total = d3.sum(data, item => item.value);
    const colorDomain = new Set(allNames);
    const colorRange = legendData.map(item => item.color);
    const color = d3.scaleOrdinal().domain(colorDomain).range(colorRange);
    const geometry = { centerX, centerY, radius };

    chart.attr('role', 'img').attr('aria-label', ariaLabel);
    pieRedraw.current = () => drawPie(chart, data, color, geometry, total);
    pieRedraw.current();

    if (showLegend) {
      drawLegend(chart, legendData, color, {
        legendX: chartWidth - padding - legendWidth,
        maxTextWidth: Math.max(0, legendWidth - LEGEND_RECT_WIDTH - LEGEND_TEXT_GAP),
      }, chartHeight);
    }
  };

  useChartDraw({
    target: ref,
    data: chartData,
    chartId: 'pie',
    options,
    drawEmptyData: true,
    draw: drawChart,
  });

  return <div className="chart-svg-wrapper flex-1 seaqa-chart-pie" ref={ref}></div>;
};

export default Pie;
