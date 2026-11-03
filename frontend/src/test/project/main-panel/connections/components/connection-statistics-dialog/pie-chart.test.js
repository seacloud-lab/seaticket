import React from 'react';
import { render, screen } from '@testing-library/react';
import StatisticsPieChart from '@/project/main-panel/connections/components/connection-statistics-dialog/pie-chart';
import { getSeriesColor } from '@/project/main-panel/connections/components/connection-statistics-dialog/utils';

jest.mock('@/constants', () => ({ gettext: text => text }));

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 300, height: 300, top: 0, left: 0, right: 300, bottom: 300,
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
afterEach(() => jest.restoreAllMocks());

it('sums all months by type and shows accurate percentages and matching colors', () => {
  const series = [
    { issue_type: 'Bug', counts: [4, 8] },
    { issue_type: null, counts: [5, 5] },
    { issue_type: 'Question', counts: [2, 4] },
    { issue_type: 'Feature', counts: [1, 1] },
  ];
  const { container } = render(<StatisticsPieChart series={series} />);
  expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Issue types');
  const slices = container.querySelectorAll('.chart-slice');
  expect(slices).toHaveLength(4);
  ['40.0%', '33.3%', '20.0%', '6.7%'].forEach(percentage => {
    expect(screen.getByText(percentage)).not.toBeNull();
  });
  slices.forEach((slice, index) => {
    expect(slice.getAttribute('fill')).toBe(getSeriesColor(series[index].issue_type));
    expect(slice.getAttribute('d')).not.toMatch(/NaN|Infinity/);
  });
  expect(slices[0].getAttribute('aria-label')).toBe('Bug: 12 (40.0%)');
  expect(slices[1].querySelector('title').textContent).toBe('Unclassified: 10 (33.3%)');
});

it.each([
  { series: [] },
  { series: [{ issue_type: null, counts: [0, 0] }] },
])('renders a neutral empty chart without invalid percentages for $series', ({ series }) => {
  const { container } = render(<StatisticsPieChart series={series} />);
  expect(container.querySelectorAll('.chart-slice')).toHaveLength(0);
  expect(container.querySelector('.chart-pie-empty')).not.toBeNull();
  expect(container.textContent).not.toMatch(/NaN|Infinity|%/);
});

it('renders a complete circle for one type and skips zero-count slices', () => {
  const series = [
    { issue_type: 'Bug', counts: [1, 2] },
    { issue_type: 'Feature', counts: [0, 0] },
  ];
  const { container } = render(<StatisticsPieChart series={series} />);
  expect(container.querySelectorAll('.chart-slice')).toHaveLength(1);
  expect(screen.getByText('100.0%')).not.toBeNull();
  expect(screen.getByText('Feature')).not.toBeNull();
});

it('keeps tiny-slice counts in tooltips without overlapping percentage labels', () => {
  const series = [
    { issue_type: 'Bug', counts: [999] },
    { issue_type: 'Feature', counts: [1] },
  ];
  const { container } = render(<StatisticsPieChart series={series} />);
  expect(container.querySelectorAll('.chart-slice')).toHaveLength(2);
  expect(container.querySelectorAll('.chart-percentage')).toHaveLength(1);
  expect(container.querySelectorAll('title')[1].textContent).toBe('Feature: 1 (0.1%)');
});

it('omits overlapping labels when many equally sized types share the pie', () => {
  const series = Array.from({ length: 20 }, (_, index) => ({ issue_type: `Type ${index}`, counts: [1] }));
  const { container } = render(<StatisticsPieChart series={series} />);
  expect(container.querySelectorAll('.chart-slice')).toHaveLength(20);
  const labels = Array.from(container.querySelectorAll('.chart-percentage')).map(label => ({
    x: Number(label.getAttribute('x')),
    y: Number(label.getAttribute('y')),
    halfWidth: label.textContent.length * 4 + 2,
  }));
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.length).toBeLessThan(20);
  labels.forEach((label, index) => labels.slice(index + 1).forEach(other => {
    expect(Math.abs(label.x - other.x) >= label.halfWidth + other.halfWidth || Math.abs(label.y - other.y) >= 20).toBe(true);
  }));
});
