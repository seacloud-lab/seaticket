import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { connectionsAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import Records from '@/project/main-panel/connections/view/connection/records';

const mockMetadataProps = jest.fn();

jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/models/user', () => jest.fn());
jest.mock('@/project/api', () => ({ connectionsAPI: { getConnectionDetails: jest.fn() } }));
jest.mock('@/project/components/resource-details-dialog', () => ({ resource }) => <div role="dialog">Record {resource._id}</div>);
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}), useMetadata: () => ({}) }));
jest.mock('@/project/hooks/link-ticket', () => ({
  useLinkedTicketUpdate: () => {},
  useLinkTicket: () => ({ generateConnectionLinkTicketOptions: () => [] }),
}));
jest.mock('@/project/hooks/related-issues', () => ({ useRelatedIssues: () => ({}) }));
jest.mock('@/project/hooks/resource-dialog', () => ({ useResourceUpdate: () => {} }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_TYPE: { GITHUB_ISSUE: 'github_issue' },
  CONNECTION_PREDEFINED_COLUMN_NAME: {},
  SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES: [],
  CONNECTION_COLUMNS_WIDTH_CONFIG: {},
  CONNECTION_COLUMNS_ORDER_CONFIG: {},
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({
  useConnectionsPage: () => ({}),
  useConnections: () => ({ connections: [{ id: 1, type: 'github_issue' }] }),
}));
jest.mock('@/project/main-panel/connections/utils', () => ({
  getTableName: () => 'github_issue_1',
  formatColumns: (_connection, columns) => columns,
}));
jest.mock('@/project/utils', () => ({}));
jest.mock('@/sea-metadata', () => {
  const React = require('react');
  return {
    __esModule: true,
    ...jest.requireActual('@/sea-metadata/controller-provider'),
    default: React.forwardRef((props, ref) => {
      mockMetadataProps(props);
      return (
        <>
          <button onClick={() => props.expandRow({ _id: 'A' })}>Open A</button>
          <button onClick={() => props.expandRow({ _id: 'B' })}>Open B</button>
        </>
      );
    }),
  };
});
jest.mock('@/sea-metadata/utils/cell', () => ({}));
jest.mock('@/sea-metadata/utils/column', () => ({}));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/utils/utils', () => ({}));

describe('Connection record dialogs during list reloads', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;
  let container;
  const getMetadata = params => mockMetadataProps.mock.calls.slice(-1)[0][0].api.getMetadata(params);

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
  beforeEach(() => {
    jest.clearAllMocks();
    useData.mockReturnValue({ getMetadata: (_table, _params, load) => load() });
    connectionsAPI.getConnectionDetails.mockResolvedValue({ data: { records: [], columns: [] } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Records projectUuid="project" permission="rw" connectionID={1} />));
    act(() => screen.getByRole('button', { name: 'Open A' }).click());
    expect(screen.getByRole('dialog').textContent).toBe('Record A');
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(['success', 'failure'])('closes before a reload completes with %s', async outcome => {
    let finish;
    connectionsAPI.getConnectionDetails.mockReturnValue(new Promise((resolve, reject) => {
      finish = () => outcome === 'success' ? resolve({ data: { records: [], columns: [] } }) : reject(new Error('Reload failed'));
    }));
    let request;
    act(() => { request = getMetadata({ view_id: 'all', start: 0, limit: 1000, is_reload: true }).catch(() => {}); });
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => { finish(); await request; });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => screen.getByRole('button', { name: 'Open B' }).click());
    expect(screen.getByRole('dialog').textContent).toBe('Record B');
  });

  it('keeps the dialog open when loading more rows', async () => {
    await act(async () => { await getMetadata({ view_id: 'all', start: 1000, limit: 1000 }); });
    expect(screen.getByRole('dialog').textContent).toBe('Record A');
  });
});
