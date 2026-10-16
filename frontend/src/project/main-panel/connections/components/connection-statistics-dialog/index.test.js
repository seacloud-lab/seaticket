import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { connectionsAPI } from '@/project/api';
import ConnectionStatisticsDialog from './index';

jest.mock('./index.css', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/api', () => ({
  connectionsAPI: { getConnectionStatistics: jest.fn() },
}));
jest.mock('@/utils/utils', () => ({
  Utils: { getErrorMsg: error => error.message },
}));
jest.mock('@/components', () => ({
  CenteredLoading: () => <div role="status">Loading</div>,
  Icon: () => null,
  ModalHeader: ({ children, toggle }) => <div>{children}<button onClick={toggle}>Close</button></div>,
}));
jest.mock('reactstrap', () => ({
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
  Modal: ({ children }) => <div role="dialog">{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
}));
jest.mock('./chart', () => ({ months, series }) => (
  <div data-testid="chart">{months.join(',')} / {series[0]?.issue_type}</div>
));

const connection = { id: 7, name: 'GitHub Support' };
const result = {
  months: ['2025-11', '2026-10'],
  series: [{ issue_type: 'Bug', counts: [1, 2] }],
  total: 3,
};
const props = { projectUuid: 'project-1', connection, onToggle: jest.fn() };

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it('loads statistics without a supported flag for the selected connection and closes the dialog', async () => {
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data: result });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(screen.getByRole('status')).not.toBeNull();
  expect(await screen.findByTestId('chart')).not.toBeNull();
  expect(connectionsAPI.getConnectionStatistics).toHaveBeenCalledWith(
    'project-1', 7, expect.any(AbortSignal), Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  expect(screen.getByText('GitHub Support')).not.toBeNull();
  expect(screen.getByText('Total issues: 3')).not.toBeNull();
  expect(screen.getByText('2025-11 - 2026-10')).not.toBeNull();
  expect(screen.queryByText(/UTC|undefined/)).toBeNull();
  fireEvent.click(screen.getByText('Close'));
  expect(props.onToggle).toHaveBeenCalledTimes(1);
});

it('requests statistics in the browser timezone so the months match the issue list', async () => {
  jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' }),
  });
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data: result });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByTestId('chart')).not.toBeNull();
  expect(connectionsAPI.getConnectionStatistics).toHaveBeenCalledWith(
    'project-1', 7, expect.any(AbortSignal), 'Asia/Shanghai'
  );
});

it('shows an API error for an unsupported connection instead of a chart', async () => {
  const message = 'Connection type does not support statistics.';
  connectionsAPI.getConnectionStatistics.mockRejectedValue({
    message,
    response: { status: 400, data: { error_msg: message } },
  });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByRole('alert')).not.toBeNull();
  expect(screen.getByText(message)).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
  expect(screen.queryByTestId('chart')).toBeNull();
});

it('retains the 12-month chart when there are no issues', async () => {
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data: { ...result, total: 0 } });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByText('No issues in the past 12 months.')).not.toBeNull();
  expect(screen.queryByTestId('chart')).not.toBeNull();
});

it('renders empty statistics without state or timezone fields', async () => {
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data: { ...result, total: 0, series: [] } });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByText('No issues in the past 12 months.')).not.toBeNull();
  expect(screen.getByText('2025-11 - 2026-10')).not.toBeNull();
  expect(screen.getByTestId('chart')).not.toBeNull();
  expect(screen.queryByText('This connection has not been synced yet.')).toBeNull();
});

it('retries after an API failure', async () => {
  connectionsAPI.getConnectionStatistics.mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ data: result });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByRole('alert')).not.toBeNull();
  fireEvent.click(screen.getByText('Retry'));
  expect(await screen.findByTestId('chart')).not.toBeNull();
  expect(connectionsAPI.getConnectionStatistics).toHaveBeenCalledTimes(2);
});

it('cancels requests on close', () => {
  connectionsAPI.getConnectionStatistics.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<ConnectionStatisticsDialog {...props} />);
  const signal = connectionsAPI.getConnectionStatistics.mock.calls[0][2];
  unmount();
  expect(signal.aborted).toBe(true);
});

it('ignores a previous connection response after switching connections', async () => {
  let resolvePrevious;
  connectionsAPI.getConnectionStatistics.mockReturnValueOnce(new Promise(resolve => {
    resolvePrevious = resolve;
  })).mockResolvedValueOnce({ data: { ...result, total: 19 } });
  const { rerender } = render(<ConnectionStatisticsDialog {...props} />);
  const oldSignal = connectionsAPI.getConnectionStatistics.mock.calls[0][2];
  rerender(<ConnectionStatisticsDialog {...props} connection={{ id: 8, name: 'Jira' }} />);
  await screen.findByText('Total issues: 19');
  await act(async () => resolvePrevious({ data: result }));
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() => expect(screen.queryByText('Total issues: 3')).toBeNull());
});
