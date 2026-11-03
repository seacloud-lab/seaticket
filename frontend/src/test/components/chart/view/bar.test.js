import React from 'react';
import { render } from '@testing-library/react';
import { STYLE_COLORS } from '@/components/chart/constants';
import { Bar } from '@/components/chart/view';

jest.mock('@/constants', () => ({ gettext: text => text }));

const data = [{ name: 'January', value: 0.2 }, { name: 'February', value: 0.3 }];

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300,
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});
afterEach(() => jest.restoreAllMocks());

it('preserves the existing flat data API and default color', () => {
  const { container } = render(<Bar data={data} />);
  const bars = container.querySelectorAll('.content-wrapper > rect');
  expect(bars).toHaveLength(2);
  bars.forEach(bar => {
    expect(bar.getAttribute('fill')).toBe(STYLE_COLORS[0].colors[0]);
    expect(Number(bar.getAttribute('height'))).toBeGreaterThan(0);
    expect(Number(bar.getAttribute('width'))).toBeGreaterThan(0);
  });
  expect(Number(bars[1].getAttribute('height'))).toBe(260);
  expect(container.querySelector('.chart-value')).toBeNull();
});

it('renders grouped values and colors without knowing the business field names', () => {
  const grouped = [{ name: 'January', values: [
    { name: 'First', value: 2, color: '#123456' },
    { name: 'Second', value: 3, color: '#654321' },
  ] }];
  const { container } = render(<Bar data={grouped} options={{ showValues: true }} />);
  const bars = container.querySelectorAll('.content-wrapper > rect');
  expect(bars).toHaveLength(2);
  expect(bars[0].getAttribute('fill')).toBe('#123456');
  expect(bars[1].getAttribute('fill')).toBe('#654321');
  expect(bars[0].getAttribute('x')).not.toBe(bars[1].getAttribute('x'));
  expect(bars[0].getAttribute('aria-label')).toBe('January / First: 2');
  expect(container.querySelectorAll('.chart-value')).toHaveLength(2);
});

