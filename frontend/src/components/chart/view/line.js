import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { initChart, destroyChart, drawYaxis, getMinDistanceItem, clearOldVerticalAnnotation, addVerticalAnnotation, checkTickOverlap } from '../utils';
import { CHART_THEME_COLOR, CHART_STYLE_COLORS } from '../constants';
import ToolTip from '../components/tooltip';
import { gettext } from '@/constants';

import './index.css';

const Line = ({ data }) => {
  const [tooltipData, setTooltipData] = useState(null);
  const [toolTipPosition, setToolTipPosition] = useState(null);
  const ref = useRef(null);
  const chartRef = useRef(null);

  const getPointerPosition = (event) => {
    if (!chartRef.current?.node) {
      return { offsetX: event.offsetX, offsetY: event.offsetY };
    }
    const [offsetX, offsetY] = d3.pointer(event, chartRef.current.node());
    return { offsetX, offsetY };
  };

  const showTooltip = (position, data) => {
    const { offsetX, offsetY } = position;
    const newTooltipData = {
      title: gettext('Amount'),
      items: [
        {
          color: CHART_STYLE_COLORS[0],
          name: data.name,
          value: data.value
        }
      ]
    };
    setTooltipData(newTooltipData);
    setToolTipPosition({ offsetX, offsetY });
  };

  const moveTooltip = (position, data) => {
    const { offsetX, offsetY } = position;
    const newTooltipData = {
      title: gettext('Amount'),
      items: [
        {
          color: CHART_STYLE_COLORS[0],
          name: data.name,
          value: data.value
        }
      ]
    };
    setTooltipData(newTooltipData);
    setToolTipPosition({ offsetX, offsetY });
  };

  const hiddenTooltip = () => {
    setToolTipPosition(null);
  };

  const drawChart = (chart, container, data = []) => {
    const { width: chartWidth, height: chartHeight, insertPadding } = container.chartBoundingClientRect;
    const theme = CHART_THEME_COLOR;

    // Y axis
    const niceEnd = d3.nice(0, d3.max(data, (d) => d.value), 5)[1];
    const y = d3.scaleLinear()
      .domain([0, niceEnd])
      .range([chartHeight - insertPadding, insertPadding]);

    chart.append('g')
      .attr('class', 'y-axis-wrapper')
      .attr('transform', `translate(${insertPadding}, 0)`)
      .call(d3.axisLeft(y).tickSizeInner(0).ticks(5).tickFormat((d) => d))
      .call(g => drawYaxis(g, theme, 0, container));

    // X axis
    const xDomain = data.map(item => item.name);
    const x = d3.scaleBand()
      .domain(xDomain)
      .range([insertPadding + container.horizontalOverflowOffset, chartWidth - insertPadding])
      .paddingInner(0.4)
      .paddingOuter(0.1);

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

    // Line
    const circleData = xDomain.map(() => ({}));
    const line = d3.line()
      .x((d, index) => {
        const xVal = x(d.name) + x.bandwidth() / 2;
        circleData[index]['x'] = xVal;
        circleData[index]['name'] = d.name;
        return xVal;
      })
      .y((d, index) => {
        const yVal = y(d.value);
        circleData[index]['y'] = yVal;
        circleData[index]['value'] = d.value;
        return yVal;
      })
      .curve(d3.curveBumpX);

    const contentWrapper = chart.append('g').attr('class', 'content-wrapper');
    contentWrapper
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', CHART_STYLE_COLORS[0])
      .attr('stroke-width', 2)
      .attr('d', () => line(data));

    // circle
    circleData.forEach(item => {
      contentWrapper.append('circle')
        .attr('cx', item.x)
        .attr('cy', item.y)
        .attr('r', 3)
        .attr('fill', 'white')
        .attr('opacity', 1)
        .attr('stroke', CHART_STYLE_COLORS[0])
        .attr('stroke-width', 2)
        .attr('data-text', item.value)
        .attr('data-name', item.name);
    });

    chart
      .on('mouseover', (event) => {
        const position = getPointerPosition(event);
        const { offsetX } = position;
        const minDistanceItem = getMinDistanceItem(offsetX, circleData);
        showTooltip(position, minDistanceItem);
        clearOldVerticalAnnotation(contentWrapper);
        addVerticalAnnotation(contentWrapper, minDistanceItem, theme, container.chartBoundingClientRect);
      })
      .on('mousemove', (event) => {
        const position = getPointerPosition(event);
        const { offsetX } = position;
        const minDistanceItem = getMinDistanceItem(offsetX, circleData);
        moveTooltip(position, minDistanceItem);
        clearOldVerticalAnnotation(contentWrapper);
        addVerticalAnnotation(contentWrapper, minDistanceItem, theme, container.chartBoundingClientRect);
      })
      .on('mouseleave', () => {
        hiddenTooltip();
        clearOldVerticalAnnotation(contentWrapper);
      });
  };

  useEffect(() => {
    const initConfig = { insertPadding: 20 };
    initChart(ref, chartRef, 'line', initConfig);

    return () => {
      destroyChart(chartRef);
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!chartRef.current || !ref.current) return;

    drawChart(chartRef.current, ref.current, data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="chart-svg-wrapper flex-1" ref={ref}>
      <ToolTip tooltipData={tooltipData} toolTipPosition={toolTipPosition} chart={chartRef.current} />
    </div>
  );
};

export default Line;
