import { useLayoutEffect, useRef } from 'react';
import { initChart, destroyChart } from '../utils';

const useChartDraw = ({ target, data, chartId, options, draw, drawEmpty = false }) => {
  const chartRef = useRef(null);
  const dataRef = useRef(data);
  const drawRef = useRef(draw);
  const optionsRef = useRef(options);
  const drawEmptyRef = useRef(drawEmpty);
  const chartSizeRef = useRef(null);

  dataRef.current = data;
  drawRef.current = draw;
  optionsRef.current = options;
  drawEmptyRef.current = drawEmpty;

  const redrawChart = () => {
    if (!target.current) return;

    destroyChart(chartRef);
    initChart(target, chartRef, chartId, optionsRef.current);

    const { width, height } = target.current.getBoundingClientRect();
    chartSizeRef.current = { width, height };

    if (Array.isArray(dataRef.current) && (dataRef.current.length > 0 || drawEmptyRef.current)) {
      drawRef.current(chartRef.current, target.current, dataRef.current);
    }
  };

  useLayoutEffect(() => {
    const { width, height } = target.current.getBoundingClientRect();
    chartSizeRef.current = { width, height };

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const previousSize = chartSizeRef.current;
      if (previousSize?.width === width && previousSize?.height === height) return;

      redrawChart();
    });
    resizeObserver.observe(target.current);

    return () => {
      resizeObserver.disconnect();
      destroyChart(chartRef);
      chartRef.current = null;
    };
  // Resize callbacks use refs to read the latest data, options and drawing function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    redrawChart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options, drawEmpty]);

  return chartRef.current;
};

export default useChartDraw;
