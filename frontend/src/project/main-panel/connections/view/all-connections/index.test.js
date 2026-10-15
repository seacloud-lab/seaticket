import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AllConnections from './index';

jest.mock('./index.css', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/constants', () => ({ BAR_TYPE: { CONNECTION: 'connection' } }));
jest.mock('@/project/api', () => ({ connectionsAPI: { queryConnectionsStatus: jest.fn() } }));
jest.mock('@/utils/array-utils', () => ({ areArraysEqual: () => true }));
jest.mock('@/utils/dayjs', () => jest.fn());
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/utils/self-query', () => function SelfQuery() {
  this.start = jest.fn();
  this.clear = jest.fn();
});
jest.mock('@/components/modal-portal', () => ({ children }) => <>{children}</>);
jest.mock('@/components', () => ({
  Icon: () => null,
  toaster: { success: jest.fn(), danger: jest.fn() },
  CenteredLoading: () => null,
  EmptyTip: () => null,
  CustomizeTable: ({ rows, onRowContextMenu, onViewStatistics }) => (
    <div>
      {rows.map(row => (
        <div key={row.id} data-testid={`connection-${row.id}`} onContextMenu={event => onRowContextMenu(event, row)}>
          {row.name}
          <button onClick={() => onViewStatistics(row)}>Statistics {row.id}</button>
        </div>
      ))}
    </div>
  ),
}));
jest.mock('../../hooks', () => {
  global.window.app = { pageOptions: { isProjectAdmin: false }, config: { mediaUrl: '/media/' } };
  return {
    useConnections: () => ({
      isLoading: false,
      connections: [
        { id: 7, name: 'GitHub', type: 'github_issue' },
        { id: 8, name: 'Jira', type: 'jira_issue' },
        { id: 9, name: 'Site', type: 'site' },
        { id: 10, name: 'Email', type: 'email' },
      ],
      reloadConnections: jest.fn(),
      modifyLocalConnectionsSyncStatus: jest.fn(),
    }),
    useConnectionsPage: () => ({ togglePageSlugId: jest.fn() }),
  };
});
jest.mock('../../utils', () => ({ isConnectionSyncCompleted: () => true, isConnectionFirstSync: () => false }));
jest.mock('../../components/cell-formatter', () => () => null);
jest.mock('../../components/configure-webhook-dialog', () => () => null);
jest.mock('../../components/connection-logs-dialog', () => () => null);
jest.mock('../../components/connection-status-dialog', () => () => null);
jest.mock('../../components/connection-statistics-dialog', () => ({ connection, onToggle }) => (
  <div role="dialog">{`Statistics for ${connection.id}`}<button onClick={onToggle}>Close</button></div>
));
jest.mock('../../constants', () => ({
  CONNECTION_FIELD_TYPE: {},
  CONNECTION_SYNC_STATUS: {},
  CONNECTION_TYPE: { GITHUB_ISSUE: 'github_issue' },
}));

it('opens statistics for the right-clicked connection without navigation', () => {
  const modifyLocalBar = jest.fn();
  render(<AllConnections projectUuid="project-1" modifyLocalBar={modifyLocalBar} />);
  fireEvent.contextMenu(screen.getByTestId('connection-7'), { clientX: 50, clientY: 60 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Statistics' }));
  expect(screen.getByRole('dialog').textContent).toContain('Statistics for 7');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(modifyLocalBar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Close'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('opens the same dialog from the more-menu callback', () => {
  render(<AllConnections projectUuid="project-1" />);
  fireEvent.click(screen.getByText('Statistics 7'));
  expect(screen.getByRole('dialog').textContent).toContain('Statistics for 7');
});

it('dismisses the right-click menu with Escape and outside clicks', () => {
  render(<AllConnections projectUuid="project-1" />);
  fireEvent.contextMenu(screen.getByTestId('connection-7'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.contextMenu(screen.getByTestId('connection-7'));
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
});

it.each([8, 9, 10])('does not open a statistics menu or dialog for non-GitHub connection %s', id => {
  render(<AllConnections projectUuid="project-1" />);
  expect(fireEvent.contextMenu(screen.getByTestId(`connection-${id}`))).toBe(true);
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByText(`Statistics ${id}`));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('clears a previous GitHub menu when right-clicking another connection type', () => {
  render(<AllConnections projectUuid="project-1" />);
  fireEvent.contextMenu(screen.getByTestId('connection-7'));
  expect(screen.getByRole('menu')).not.toBeNull();
  fireEvent.contextMenu(screen.getByTestId('connection-8'));
  expect(screen.queryByRole('menu')).toBeNull();
});
