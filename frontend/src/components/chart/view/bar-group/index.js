import React, { useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { gettext } from '@/constants';
import ChartTooltip from '../../chart-tooltip';
import { STYLE_COLORS, CHART_THEME_COLOR } from '../../constants';
import { drawYaxis, addClipPath, checkTickOverlap } from '../../utils';
import useChartDraw from '../use-chart-redraw';

import './index.css';

const EMPTY_DATA = [];
const DEFAULT_OPTIONS = {};
const BAR_ENTER_DURATION = 450;
const BAR_INTERACTION_DURATION = 150;
const LEGEND_PADDING = 20;
const LEGEND_RECT_WIDTH = 20;
const LEGEND_RECT_HEIGHT = 6;
const LEGEND_TEXT_GAP = 8;
const LEGEND_ITEM_GAP = 20;
const LEGEND_NAV_WIDTH = 82;

const getSeriesName = (value, fallback = '') => {
  const name = value?.group_name ?? value?.groupName ?? value?.name ?? fallback;
  return name == null ? '' : String(name);
};

const getCategoryName = (value) => {
  const name = value?.name ?? value?.category ?? '';
  return name == null ? '' : String(name);
};

const getNumericValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeChartData = (data, theme) => {
  const source = Array.isArray(data) ? data.filter(Boolean) : [];
  const palette = STYLE_COLORS.find(item => item.name === theme)?.colors || STYLE_COLORS[0].colors;
  const hasRows = source.some(item => Array.isArray(item.values));
  const hasFlatSeries = source.some(item => Object.prototype.hasOwnProperty.call(item, 'group_name') || Object.prototype.hasOwnProperty.call(item, 'groupName'));
  let rows = [];
  let isGrouped = hasRows || hasFlatSeries;

  if (hasRows) {
    rows = source.map((item) => ({
      name: getCategoryName(item),
      values: (Array.isArray(item.values) ? item.values : [item]).map((value, index) => ({
        ...value,
        name: getSeriesName(value, `Series ${index + 1}`),
        value: getNumericValue(value.value),
        color: value.color,
      })),
    }));
  } else if (hasFlatSeries) {
    const rowsByName = new Map();
    source.forEach((item) => {
      const categoryName = getCategoryName(item);
      if (!rowsByName.has(categoryName)) rowsByName.set(categoryName, { name: categoryName, values: [] });
      rowsByName.get(categoryName).values.push({
        ...item,
        name: getSeriesName(item, 'Series 1'),
        value: getNumericValue(item.value),
        color: item.color,
      });
    });
    rows = Array.from(rowsByName.values());
  } else {
    // Keep seaticket's original single-series entries usable alongside sea-chart's
    // name/group_name/value records.
    rows = source.map((item) => ({
      name: getCategoryName(item),
      values: [{
        ...item,
        name: getCategoryName(item),
        value: getNumericValue(item.value),
        color: item.color,
      }],
    }));
  }

  const seriesColors = new Map();
  rows.forEach(row => row.values.forEach((item) => {
    if (!seriesColors.has(item.name)) {
      const seriesIndex = seriesColors.size;
      seriesColors.set(item.name, item.color || palette[seriesIndex % palette.length]);
    }
  }));

  rows = rows.map(row => ({
    ...row,
    values: row.values.map(item => ({
      ...item,
      color: item.color || (isGrouped ? seriesColors.get(item.name) : palette[0]) || palette[0],
    })),
  }));

  const series = isGrouped
    ? Array.from(seriesColors, ([name, color]) => ({ name, color }))
    : [];

  return { rows, series, isGrouped };
};

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

const paginateLegend = (items, maxWidth, textWidths) => {
  const pages = [];
  let page = [];
  let pageWidth = 0;
  items.forEach((item) => {
    const itemWidth = Math.min(maxWidth, LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP + textWidths.get(item.name));
    const nextWidth = page.length ? pageWidth + LEGEND_ITEM_GAP + itemWidth : itemWidth;
    if (page.length && nextWidth > maxWidth) {
      pages.push(page);
      page = [];
      pageWidth = 0;
    }
    pageWidth += page.length ? LEGEND_ITEM_GAP + itemWidth : itemWidth;
    page.push(item);
  });
  if (page.length) pages.push(page);
  return pages;
};

const drawLegend = ({ chart, entries, hiddenSeries, onToggle }) => {
  if (!entries.length) return;

  const chartWidth = Number(chart.attr('width')) || 0;
  const availableWidth = Math.max(1, chartWidth - LEGEND_PADDING * 2);
  const measurer = chart.append('g').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  const textWidths = new Map();
  entries.forEach((item) => {
    const displayName = item.name === '' ? gettext('Empty') : item.name;
    const textNode = measurer.append('text')
      .attr('font-size', CHART_THEME_COLOR.legendFontSize)
      .text(displayName)
      .node();
    textWidths.set(item.name, getSvgTextWidth(textNode));
  });
  measurer.remove();

  let pages = paginateLegend(entries, availableWidth, textWidths);
  const hasPagination = pages.length > 1;
  const contentWidth = Math.max(1, availableWidth - (hasPagination ? LEGEND_NAV_WIDTH : 0));
  if (hasPagination) pages = paginateLegend(entries, contentWidth, textWidths);

  const legendWrapper = chart.append('g').attr('class', 'legend-wrapper');
  const legendItems = legendWrapper.append('g').attr('class', 'legend-items');
  const pageNavigator = hasPagination ? legendWrapper.append('g').attr('class', 'legend-flip-page') : null;
  let currentPage = 0;

  const updateNavigator = () => {
    if (!pageNavigator) return;
    pageNavigator.select('.legend-count').text(`${currentPage + 1}/${pages.length}`);
    pageNavigator.select('.legend-prev-page').attr('opacity', currentPage === 0 ? 0.45 : 1);
    pageNavigator.select('.legend-next-page').attr('opacity', currentPage === pages.length - 1 ? 0.45 : 1);
  };

  const renderPage = () => {
    legendItems.selectAll('*').remove();
    const pageEntries = pages[currentPage] || [];
    let cursorX = 0;
    pageEntries.forEach((item) => {
      const displayName = item.name === '' ? gettext('Empty') : item.name;
      const group = legendItems.append('g')
        .attr('class', 'legend-item')
        .attr('data-groupName', item.name)
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-label', `${gettext('Toggle')} ${displayName}`)
        .style('cursor', 'pointer');
      group.append('rect')
        .attr('width', LEGEND_RECT_WIDTH)
        .attr('height', LEGEND_RECT_HEIGHT)
        .attr('y', 5)
        .attr('rx', 3)
        .attr('fill', item.color);
      const text = group.append('text')
        .attr('x', LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP)
        .attr('y', 13)
        .attr('fill', CHART_THEME_COLOR.legendTextColor)
        .attr('font-size', CHART_THEME_COLOR.legendFontSize)
        .text(displayName)
        .node();
      const maxTextWidth = Math.max(0, contentWidth - LEGEND_RECT_WIDTH - LEGEND_TEXT_GAP);
      const wasTruncated = truncateLegendText(text, maxTextWidth);
      const renderedTextWidth = getSvgTextWidth(text);
      if (wasTruncated) d3.select(text).append('title').text(displayName);
      const itemWidth = LEGEND_RECT_WIDTH + LEGEND_TEXT_GAP + renderedTextWidth;
      group.attr('transform', `translate(${cursorX}, 0)`);
      cursorX += itemWidth + LEGEND_ITEM_GAP;

      const updateOpacity = (element) => {
        const isHidden = hiddenSeries.has(item.name);
        d3.select(element).attr('opacity', isHidden ? 0.35 : 1).attr('aria-pressed', isHidden);
      };
      const toggle = (event) => {
        const isHidden = onToggle(item.name);
        if (isHidden === null) return;
        group
          .attr('aria-pressed', isHidden)
          .transition('bar-group-legend')
          .duration(BAR_INTERACTION_DURATION)
          .attr('opacity', isHidden ? 0.35 : 1);
        if (event?.type === 'click') group.node()?.blur?.();
      };
      group.each(function () { updateOpacity(this); })
        .on('mousedown', event => event.preventDefault())
        .on('click', toggle)
        .on('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        });
    });

    const renderedWidth = Math.max(0, cursorX - LEGEND_ITEM_GAP);
    const rightEdge = chartWidth - LEGEND_PADDING;
    legendItems.attr('transform', `translate(${rightEdge - renderedWidth}, 0)`);
    if (pageNavigator) {
      pageNavigator.attr('transform', `translate(${Math.max(LEGEND_PADDING, rightEdge - renderedWidth - LEGEND_NAV_WIDTH)}, 0)`);
      updateNavigator();
    }

    legendItems.selectAll('.legend-item').each(function () {
      const targetOpacity = hiddenSeries.has(this.getAttribute('data-groupName')) ? 0.35 : 1;
      d3.select(this)
        .attr('opacity', 0)
        .transition('bar-group-enter')
        .duration(BAR_ENTER_DURATION)
        .ease(d3.easeLinear)
        .attr('opacity', targetOpacity);
    });
  };

  if (pageNavigator) {
    pageNavigator.append('text')
      .attr('class', 'legend-count')
      .attr('x', 34)
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
      .attr('points', '66,1 74,7 66,13')
      .attr('fill', CHART_THEME_COLOR.legendPageNavigatorMarkerColor)
      .style('cursor', 'pointer')
      .on('click', () => {
        if (currentPage < pages.length - 1) {
          currentPage++;
          renderPage();
        }
      });
  }

  renderPage();
};

const BarGroup = ({
  data = EMPTY_DATA,
  yAxisShowLabel = true,
  xAxisShowLabel = true,
  yAxisShowValue = true,
  theme = 'theme0',
  options = DEFAULT_OPTIONS,
  ariaLabel,
}) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [toolTipPosition, setToolTipPosition] = useState(null);
  const hiddenSeriesRef = useRef(new Set());
  const ref = useRef(null);
  const chartId = useId().replace(/:/g, '');
  const chartData = useMemo(() => normalizeChartData(data, theme), [data, theme]);
  const insertPadding = options.insertPadding ?? 20;
  const borderRadius = options.borderRadius ?? 0.2;
  const labelRotation = options.labelRotation || 0;
  const minCategoryWidth = options.minCategoryWidth || 0;
  const maxBarWidth = options.maxBarWidth || Infinity;
  const labelFontSize = options.labelFontSize || 11;
  const chartOptions = useMemo(() => ({
    insertPadding,
    borderRadius,
    marginBottom: xAxisShowLabel ? (labelRotation ? 62 : insertPadding) : 0,
    marginTop: yAxisShowValue ? 15 : 0,
    yAxisShowLabel,
    maxBarWidth,
    labelFontSize,
    minWidth: minCategoryWidth
      ? 40 + chartData.rows.length * Math.max(minCategoryWidth, chartData.series.length * 20 + 8)
      : 0,
  }), [borderRadius, chartData.rows.length, chartData.series.length, insertPadding, labelFontSize, labelRotation, maxBarWidth, minCategoryWidth, xAxisShowLabel, yAxisShowLabel, yAxisShowValue]);

  const toggleLegendGroup = (groupName) => {
    const hiddenSeries = hiddenSeriesRef.current;
    let isHidden;
    if (hiddenSeries.has(groupName)) {
      hiddenSeries.delete(groupName);
      isHidden = false;
    } else {
      if (chartData.series.length - hiddenSeries.size <= 1) return null;
      hiddenSeries.add(groupName);
      isHidden = true;
    }

    setToolTipPosition(null);
    const chart = d3.select(ref.current).select('svg');
    chart.selectAll('.y-axis-wrapper, .x-axis-wrapper, .content-wrapper').remove();
    drawChart(chart, ref.current, chartData.rows, false);
    return isHidden;
  };

  const showTooltip = (event, item, row) => {
    const svg = ref.current?.querySelector('svg');
    const [offsetX, offsetY] = svg ? d3.pointer(event, svg) : [event.offsetX, event.offsetY];
    setTooltipData({
      title: chartData.isGrouped ? (row.name || gettext('Empty')) : gettext('Amount'),
      items: row.values.filter(value => !hiddenSeriesRef.current.has(value.name)).map(value => ({
        color: value.color,
        name: chartData.isGrouped ? (value.name || gettext('Empty')) : (value.name || row.name),
        value: value.value.toLocaleString(),
      })),
    });
    setToolTipPosition({ offsetX, offsetY });
  };

  const hideTooltip = () => setToolTipPosition(null);

  const drawChart = (chart, container, rows = [], renderLegend = true) => {
    const bounds = container.chartBoundingClientRect;
    const { width: chartWidth, height: chartHeight } = bounds;
    const { insertPadding: padding, marginTop = 0 } = bounds;
    const themeColors = CHART_THEME_COLOR;
    const visibleRows = rows.map(row => ({
      ...row,
      values: row.values.filter(item => !hiddenSeriesRef.current.has(item.name)),
    })).filter(row => row.values.length > 0);
    const values = visibleRows.flatMap(row => row.values.map(item => item.value));
    const minValue = Math.min(0, d3.min(values) ?? 0);
    const maxValue = Math.max(0, d3.max(values) ?? 0);
    const yDomain = minValue === maxValue ? [0, 1] : [minValue, maxValue];
    const y = d3.scaleLinear()
      .domain(yDomain)
      .nice(5)
      .range([chartHeight - padding, padding + marginTop]);
    const baseline = y(0);
    const categories = Array.from(new Set(rows.map(row => row.name)));
    const x = d3.scaleBand()
      .domain(categories)
      .range([padding + (container.horizontalOverflowOffset || 0), chartWidth - padding])
      .paddingInner(0.25)
      .paddingOuter(0.1);

    chart.attr('role', 'img').attr('aria-label', ariaLabel || gettext('Amount'));

    const yAxis = chart.append('g')
      .attr('class', 'y-axis-wrapper')
      .attr('transform', `translate(${padding}, 0)`)
      .call(d3.axisLeft(y)
        .tickSizeInner(0)
        .ticks(5)
        .tickFormat(value => Number(value).toLocaleString()));
    yAxis.call(g => drawYaxis(g, themeColors, 0, container));
    if (!yAxisShowLabel) {
      yAxis.selectAll('.tick text').remove();
      container.horizontalOverflowOffset = 0;
      yAxis.attr('transform', `translate(${padding}, 0)`);
      yAxis.selectAll('.tick line').attr('x2', chartWidth - padding * 2);
    }

    const xAxis = chart.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('transform', `translate(0, ${chartHeight - padding})`)
      .call(d3.axisBottom(x).tickSizeOuter(0).tickSizeInner(5));
    xAxis.call(g => {
      g.selectAll('.domain').attr('stroke', themeColors.XAxisColor);
      g.selectAll('.tick line').attr('stroke', themeColors.XAxisColor);
      g.selectAll('text').attr('font-size', themeColors.fontSize).attr('fill', themeColors.textColor);
      if (xAxisShowLabel) {
        if (labelRotation) {
          g.selectAll('text')
            .attr('transform', `rotate(${labelRotation})`)
            .attr('text-anchor', 'start')
            .attr('dx', '0.5em');
        } else {
          checkTickOverlap(g, 'xAxis', chart, bounds);
        }
      } else {
        g.selectAll('.tick text').remove();
      }
    });

    const contentWrapper = chart.append('g').attr('class', 'content-wrapper');
    const categoryGroups = contentWrapper.selectAll('.bar-category')
      .data(visibleRows)
      .join('g')
      .attr('class', 'bar-category')
      .attr('transform', row => `translate(${x(row.name)}, 0)`);

    categoryGroups.each((row, rowIndex, nodes) => {
      const localX = d3.scaleBand()
        .domain(row.values.map(item => item.name))
        .range([0, x.bandwidth()])
        .paddingInner(0)
        .paddingOuter(0);
      const barWidth = Math.min(localX.bandwidth(), maxBarWidth);
      const barData = row.values.map((item, itemIndex) => ({
        ...item,
        category: row.name,
        categoryIndex: rowIndex,
        x: localX(item.name) + (localX.bandwidth() - barWidth) / 2,
        itemIndex,
      }));
      const categoryGroup = d3.select(nodes[rowIndex]);
      const bars = categoryGroup.selectAll('rect.bar-group-bar')
        .data(barData)
        .join('rect')
        .attr('class', 'bar-group-bar')
        .attr('opacity', item => hiddenSeriesRef.current.has(item.name) ? 0 : 1)
        .style('pointer-events', item => hiddenSeriesRef.current.has(item.name) ? 'none' : 'auto')
        .attr('fill', item => item.color)
        .attr('data-value', item => item.value)
        .attr('data-groupName', item => item.name)
        .attr('data-category', row.name)
        .attr('x', item => item.x)
        .attr('y', item => Math.min(y(item.value), baseline))
        .attr('width', barWidth)
        .attr('height', item => Math.abs(y(item.value) - baseline));

      bars.each(function (item) {
        const clipId = `${chartId}-clip-${rowIndex}-${item.itemIndex}`;
        addClipPath({
          rect: this,
          parentNode: this.parentNode,
          rectId: clipId,
          chartBoundingClientRect: bounds,
        });
        const finalY = Number(this.getAttribute('y'));
        const finalHeight = Number(this.getAttribute('height'));
        if (finalHeight > 0) {
          const clipRect = d3.select(this.parentNode).select(`#${clipId}`).select('rect');
          const finalClipY = Number(clipRect.attr('y'));
          const finalClipHeight = Number(clipRect.attr('height'));
          const startY = item.value < 0 ? finalY : finalY + finalHeight;
          clipRect
            .attr('y', startY)
            .attr('height', 0)
            .transition('bar-group-enter')
            .duration(BAR_ENTER_DURATION)
            .ease(d3.easeCubicOut)
            .attr('y', finalClipY)
            .attr('height', finalClipHeight);
        }
      });

      bars.append('title').text(item => `${row.name}${chartData.isGrouped ? ` / ${item.name}` : ''}: ${item.value.toLocaleString()}`);
      bars
        .on('mouseover', (event, item) => {
          showTooltip(event, item, row);
          contentWrapper.selectAll('.bar-category')
            .transition('bar-group-interaction')
            .duration(BAR_INTERACTION_DURATION)
            .attr('opacity', function () { return this === nodes[rowIndex] ? 1 : 0.3; });
        })
        .on('mousemove', (event) => {
          const svg = ref.current?.querySelector('svg');
          const [offsetX, offsetY] = svg ? d3.pointer(event, svg) : [event.offsetX, event.offsetY];
          setToolTipPosition({ offsetX, offsetY });
        })
        .on('mouseleave', () => {
          hideTooltip();
          contentWrapper.selectAll('.bar-category')
            .transition('bar-group-interaction')
            .duration(BAR_INTERACTION_DURATION)
            .attr('opacity', 1);
        });

      if (yAxisShowValue) {
        const labels = categoryGroup.selectAll('.bar-group-value')
          .data(barData.filter(item => Number(item.value) !== 0))
          .join('text')
          .attr('class', 'bar-group-value')
          .attr('data-groupName', item => item.name)
          .attr('x', item => item.x + barWidth / 2)
          .attr('y', item => item.value < 0 ? y(item.value) + 15 : y(item.value) - 8)
          .attr('text-anchor', 'middle')
          .attr('fill', themeColors.labelColor)
          .attr('font-size', labelFontSize)
          .style('pointer-events', item => hiddenSeriesRef.current.has(item.name) ? 'none' : 'auto')
          .attr('opacity', 0)
          .text(item => item.value.toLocaleString());
        labels.transition('bar-group-enter')
          .duration(BAR_ENTER_DURATION)
          .delay(BAR_ENTER_DURATION * 0.5)
          .ease(d3.easeLinear)
          .attr('opacity', item => hiddenSeriesRef.current.has(item.name) ? 0 : 1);
      }
    });

    if (renderLegend) {
      const legendEntries = chartData.series.map(item => ({ ...item, name: item.name }));
      drawLegend({
        chart,
        entries: legendEntries,
        hiddenSeries: hiddenSeriesRef.current,
        onToggle: toggleLegendGroup,
      });
    }
  };

  const chart = useChartDraw({
    target: ref,
    data: chartData.rows,
    chartId: `bar-group-${chartId}`,
    options: chartOptions,
    draw: drawChart,
  });

  return (
    <div className="bar-group-scroll">
      <div className="bar-group-chart" ref={ref} style={options.height ? { height: options.height } : undefined}>
        <ChartTooltip tooltipData={tooltipData} toolTipPosition={toolTipPosition} chart={chart} />
      </div>
    </div>
  );
};

export default BarGroup;
