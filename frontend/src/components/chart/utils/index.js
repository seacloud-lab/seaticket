import * as d3 from 'd3';

export const initChart = (container, chartRef, id, initConfig = {}) => {
  const { width: containerWidth, height: containerHeight } = container.current.getBoundingClientRect();
  const { marginLeft = 0, marginRight = 0, marginBottom = 0 } = initConfig;
  const width = containerWidth - marginLeft - marginRight;
  const height = containerHeight - marginBottom;

  const chart = d3.create('svg')
    .attr('id', id)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);

  chartRef.current = chart;
  container.current.appendChild(chart.node());
  container.current.chartBoundingClientRect = {
    ...JSON.parse(JSON.stringify(chart.node().getBoundingClientRect())),
    ...initConfig,
    width,
    height,
  };
};

export const destroyChart = (chartRef) => {
  chartRef.current?.node() && chartRef.current?.node().remove();
};

export const checkTextOverflow = (allTextEl, container) => {
  const { insertPadding } = container.chartBoundingClientRect;
  const allTextWidth = allTextEl.map((item => {
    const { width } = item.getBoundingClientRect();
    return width;
  }));
  const maxTextWidth = Math.max(...allTextWidth);

  let horizontalOverflowOffset = 0;
  if ((maxTextWidth + 3) > insertPadding) { // horizontal overflow
    const offset = (maxTextWidth + 3) - insertPadding; // 3 is text and line default spacing
    horizontalOverflowOffset = offset;
  }
  container.horizontalOverflowOffset = horizontalOverflowOffset;
};

export const drawYaxis = (g, theme, rightAxisOffset = 0, container) => {
  const { width: chartWidth, insertPadding } = container.chartBoundingClientRect;
  // remove domain
  g.select('.domain').remove();

  // add text
  g.selectAll('text').attr('font-size', theme.fontSize);
  g.selectAll('text').attr('fill', theme.textColor);
  checkTextOverflow(g.selectAll('text').nodes(), container);
  const horizontalOverflowOffset = container.horizontalOverflowOffset;
  // line
  g.selectAll('line').node() && g.selectAll('line').node().remove(); // delete the first line
  g.selectAll('.tick line').clone()
    .attr('x2', chartWidth - insertPadding * 2 - horizontalOverflowOffset - rightAxisOffset)
    .attr('stroke', theme.gridColor)
    .attr('stroke-dasharray', '8,3');

  // update g translateX
  g.attr('transform', `translate(${insertPadding + horizontalOverflowOffset}, 0)`);
};

// Use clipPath to make rectangle rounded corners
export const addClipPath = ({ rect, parentNode, attr, rectId, chartBoundingClientRect }) => {
  const { borderRadius } = chartBoundingClientRect;

  const clipRect = d3.select(rect.cloneNode());
  if (attr === 'x') {
    const borderRadiusVal = Number(rect.getAttribute('height')) * borderRadius;
    clipRect.attr('rx', borderRadiusVal);
    clipRect.attr('x', Number(rect.getAttribute('x')) - borderRadiusVal).attr('width', Number(rect.getAttribute('width')) + borderRadiusVal);
  } else {
    const borderRadiusVal = Number(rect.getAttribute('width')) * borderRadius;
    clipRect.attr('rx', borderRadiusVal);
    clipRect.attr('height', Number(rect.getAttribute('height')) + borderRadiusVal);
  }

  const clipPath = d3.select(parentNode).append('clipPath').attr('opacity', 1).attr('id', rectId);
  clipPath.node().appendChild(clipRect.node());

  d3.select(rect).attr('clip-path', `url(#${rectId})`);
};

export const getMinDistanceItem = (offsetX, allData) => { // allData = [{x: number}]
  const newAllData = allData.filter(item => Object.keys(item).length !== 0);
  newAllData.forEach((item) => {
    item['distance'] = Math.abs(item.x - offsetX);
  });
  const minIndex = d3.minIndex(newAllData, d => d.distance);
  const minItem = newAllData[minIndex];
  return minItem;
};

export const clearOldVerticalAnnotation = (contentWrapper) => {
  const oldAnnotationWrapper = contentWrapper.selectAll('.vertical-annotation-wrapper');
  oldAnnotationWrapper.node() && oldAnnotationWrapper.node().remove();
};

export const addVerticalAnnotation = (contentWrapper, minDistanceItem, theme, chartBoundingClientRect) => {
  const { height: chartHeight, insertPadding, marginTop = 0 } = chartBoundingClientRect;
  const { x, } = minDistanceItem;
  const annotationWrapper = contentWrapper.insert('g', ':first-child').attr('class', 'vertical-annotation-wrapper');
  annotationWrapper
    .append('line')
    .attr('x1', x)
    .attr('y1', insertPadding + marginTop)
    .attr('x2', x)
    .attr('y2', chartHeight - insertPadding)
    .attr('stroke', theme.XAxisColor);
};
