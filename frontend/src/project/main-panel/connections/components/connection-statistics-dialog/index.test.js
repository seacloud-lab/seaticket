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
jest.mock('./chart', () => ({ months, series, isTotal }) => (
  <div data-testid={isTotal ? 'monthly-total-chart' : 'chart'}>
    {months.join(',')} / {JSON.stringify(series)}
  </div>
));
jest.mock('./pie-chart', () => ({ series }) => <div data-testid="pie-chart">{JSON.stringify(series)}</div>);

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
  expect(screen.getByText('Statistics')).not.toBeNull();
  expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
    'GitHub Support issue types',
    'GitHub Support monthly issue count',
    'GitHub Support issues by type',
  ]);
  expect(screen.getByTestId('pie-chart').textContent).toBe(JSON.stringify(result.series));
  expect(screen.getByTestId('monthly-total-chart').textContent).toContain('"counts":[1,2]');
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
  expect(screen.queryByTestId('pie-chart')).toBeNull();
  expect(screen.queryByTestId('monthly-total-chart')).toBeNull();
});

it('retains all three charts when there are no issues', async () => {
  connectionsAPI.getConnectionStatistics.mockResolvedValue({
    data: { ...result, series: [{ issue_type: null, counts: [0, 0] }], total: 0 },
  });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByText('No issues in the past 12 months.')).not.toBeNull();
  expect(screen.queryByTestId('chart')).not.toBeNull();
  expect(screen.queryByTestId('pie-chart')).not.toBeNull();
  expect(screen.getByTestId('monthly-total-chart').textContent).toContain('"counts":[0,0]');
});

it('renders empty statistics without state or timezone fields', async () => {
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data: { ...result, total: 0, series: [] } });
  render(<ConnectionStatisticsDialog {...props} />);
  expect(await screen.findByText('No issues in the past 12 months.')).not.toBeNull();
  expect(screen.getByTestId('chart')).not.toBeNull();
  expect(screen.getByTestId('monthly-total-chart').textContent).toContain('"counts":[0,0]');
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
  })).mockResolvedValueOnce({
    data: { ...result, series: [{ issue_type: 'Feature', counts: [9, 10] }], total: 19 },
  });
  const { rerender } = render(<ConnectionStatisticsDialog {...props} />);
  const oldSignal = connectionsAPI.getConnectionStatistics.mock.calls[0][2];
  rerender(<ConnectionStatisticsDialog {...props} connection={{ id: 8, name: 'Jira' }} />);
  await screen.findByTestId('pie-chart');
  await act(async () => resolvePrevious({ data: result }));
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() => expect(screen.getByTestId('chart').textContent).toContain('"counts":[9,10]'));
  expect(screen.getByText('Jira issue types')).not.toBeNull();
});

it('sums every issue type for the monthly totals without changing the source series', async () => {
  const data = {
    ...result,
    series: [
      { issue_type: 'Bug', counts: [2, 3] },
      { issue_type: null, counts: [4, 0] },
      { issue_type: 'Feature', counts: [1, 5] },
    ],
    total: 15,
  };
  connectionsAPI.getConnectionStatistics.mockResolvedValue({ data });
  render(<ConnectionStatisticsDialog {...props} />);
  const chart = await screen.findByTestId('monthly-total-chart');
  expect(chart.textContent).toContain('"counts":[7,8]');
  expect(chart.textContent).toContain('"issue_type":"Issue total"');
  expect(screen.getByTestId('pie-chart').textContent).toBe(JSON.stringify(data.series));
  expect(screen.getByTestId('chart').textContent).toContain(JSON.stringify(data.series));
});
