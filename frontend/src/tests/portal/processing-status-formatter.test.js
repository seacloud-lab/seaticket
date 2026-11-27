import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProcessingStatusFormatter from '@/portal/main-panel/team-emails/processing-status-formatter';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({
  Icon: ({ symbol }) => require('react').createElement('svg', { 'data-testid': symbol, 'aria-hidden': true }),
  Tooltip: jest.requireActual('@/components/tooltip').default,
}));

test.each([
  ['unprocessed', 'clock-filled', 'Processing：Your email is being processed by our supporter.'],
  ['processed', 'check-circle-filled', 'Processed：Your email has been processed by our supporter. If it has been assigned a ticket, you can check the ticket’s status. If it has not been assigned a ticket, the process is complete.'],
])('shows the icon and tooltip for %s', async (value, icon, tooltip) => {
  render(<ProcessingStatusFormatter value={value} />);

  const target = screen.getByRole('img', { name: tooltip });
  expect(target.contains(screen.getByTestId(icon))).toBe(true);
  expect(screen.queryByRole('tooltip')).toBeNull();

  fireEvent.mouseOver(target);
  expect((await screen.findByRole('tooltip')).textContent).toBe(tooltip);
});

test('renders no icon when the status value is null', () => {
  const { container } = render(<ProcessingStatusFormatter value={null} />);
  expect(container.firstChild).toBeNull();
});
