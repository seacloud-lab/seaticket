import React from 'react';
import { render, screen } from '@testing-library/react';
import StatisticsChart, { getSeriesColor } from './chart';

jest.mock('@/constants', () => ({ gettext: text => text }));

const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const series = [
  { issue_type: 'Bug', counts: [18, 21, 15, 24, 19, 22, 17, 25, 20, 16, 18, 23] },
  { issue_type: null, counts: [22, 24, 20, 26, 23, 25, 21, 27, 22, 19, 23, 24] },
];

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

it('renders all months and each series as separate bars', () => {
  const { container } = render(<StatisticsChart months={months} series={series} />);
  expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Monthly issues by type');
  expect(container.querySelectorAll('rect')).toHaveLength(24);
  expect(container.querySelectorAll('.connection-statistics-month')).toHaveLength(12);
  expect(screen.getByText('2025-11')).not.toBeNull();
  expect(screen.getByText('2026-10')).not.toBeNull();
  expect(screen.getByText('Unclassified')).not.toBeNull();
  const bar = container.querySelector('rect');
  expect(Number(bar.getAttribute('height'))).toBeGreaterThan(0);
  expect(bar.getAttribute('aria-label')).toBe('2025-11 / Bug: 18');
  expect(bar.querySelector('title').textContent).toBe('2025-11 / Bug: 18');
});

it('renders a valid zero baseline and integer ticks for all-zero data', () => {
  const { container } = render(<StatisticsChart months={months} series={[{ issue_type: null, counts: months.map(() => 0) }]} />);
  container.querySelectorAll('rect').forEach(bar => {
    expect(bar.getAttribute('height')).toBe('0');
    expect(bar.getAttribute('y')).not.toBe('NaN');
  });
  expect(container.querySelectorAll('.connection-statistics-tick text')).toHaveLength(2);
});

it('renders all months and a zero baseline when no series are available', () => {
  const { container } = render(<StatisticsChart months={months} series={[]} />);
  expect(screen.getByRole('img')).not.toBeNull();
  expect(container.querySelectorAll('.connection-statistics-month')).toHaveLength(12);
  expect(container.querySelectorAll('rect')).toHaveLength(0);
  expect(container.querySelectorAll('.connection-statistics-tick text')).toHaveLength(2);
  expect(Number.isFinite(Number(container.querySelector('.connection-statistics-baseline').getAttribute('y1')))).toBe(true);
});

it('keeps colors stable regardless of series order', () => {
  expect(getSeriesColor('Bug')).toBe('#377eb8');
  expect(getSeriesColor('Feature')).toBe('#4b9e46');
  expect(getSeriesColor('Question')).toBe('#ed8732');
  expect(getSeriesColor(null)).toBe('#999999');
  expect(getSeriesColor('Security')).toBe(getSeriesColor('security'));
});
