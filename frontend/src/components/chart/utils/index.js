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
