import React from 'react';
import { render, screen } from '@testing-library/react';
import { Ring } from '@/components/chart/view';

jest.mock('@/constants', () => ({ gettext: text => text }));

const data = [
  { name: 'First', value: 3, percentage: '60.0%' },
  { name: 'Second', value: 2, percentage: '40.0%' },
];

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

it('supports both ring and pie variants with the same data format', () => {
  const { container, rerender } = render(<Ring data={data} />);
  expect(container.querySelectorAll('.content-wrapper > path')).toHaveLength(2);
  expect(container.querySelectorAll('.label-line-wrapper polyline')).toHaveLength(2);
  expect(screen.getByText('First 60.0%')).not.toBeNull();
  expect(screen.getByText('Second 40.0%')).not.toBeNull();
  rerender(<Ring data={data} variant="pie" ariaLabel="Distribution" />);
  expect(screen.getByRole('img', { name: 'Distribution' })).not.toBeNull();
  expect(container.querySelectorAll('.chart-slice')).toHaveLength(2);
  expect(container.querySelector('.label-line-wrapper')).toBeNull();
  expect(screen.getByText('60.0%')).not.toBeNull();
  expect(container.querySelector('.chart-slice').getAttribute('d')).not.toMatch(/NaN|Infinity/);
});
