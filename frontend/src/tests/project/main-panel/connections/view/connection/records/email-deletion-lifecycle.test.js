import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { toaster } from '@/components';
import { connectionsAPI } from '@/project/api';
import { DataProvider, useData } from '@/project/hooks/data';
import Records from '@/project/main-panel/connections/view/connection/records';
import { SeaMetadataControllerProvider } from '@/sea-metadata/controller-provider';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({
  CenteredLoading: () => null,
  toaster: { notify: jest.fn(), closeAll: jest.fn(), success: jest.fn(), danger: jest.fn() },
}));
jest.mock('@/components/toaster', () => ({ success: jest.fn(), danger: jest.fn() }));
jest.mock('@/models/user', () => jest.fn());
jest.mock('@/project/api', () => ({ connectionsAPI: {
  deleteConnectionEmail: jest.fn(), getConnectionDetails: jest.fn(), listViews: jest.fn(), getView: jest.fn(),
} }));
jest.mock('@/project/components/resource-details-dialog', () => () => null);
jest.mock('@/project/hooks', () => ({
  useData: jest.requireActual('@/project/hooks/data-context').useData,
  useTags: () => ({}), useMetadata: () => ({}),
}));
jest.mock('@/api/user-api', () => ({}));
jest.mock('@/project/api/project-api', () => ({}));
jest.mock('@/components/common/notification/hooks/notification', () => ({ NotificationProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/analyze/hooks/analyze-task', () => ({ AnalyzeTaskProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/portal-issues/hooks', () => ({ PortalIssuesMetadataProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tags/hooks/tags', () => ({ TagsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tickets/hooks', () => ({
  MetadataProvider: ({ children }) => children,
  CloseLinkedIssuesProvider: ({ children }) => children,
}));
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TABLE_NAME: 'tickets', TICKET_STATE: { OPEN: 'open', CLOSED: 'closed' },
  PREDEFINED_TICKET_COLUMN_NAME: {}, MY_TICKETS_VIEW_IDS: { assigned: {}, created: {} },
}));
jest.mock('@/project/main-panel/knowledge-base/constants', () => ({ KB_TABLE_NAME: 'knowledge' }));
jest.mock('@/project/hooks/link-ticket', () => ({
  useLinkedTicketUpdate: () => {},
  useLinkTicket: () => ({ generateConnectionLinkTicketOptions: () => [] }),
}));
jest.mock('@/project/hooks/related-issues', () => ({ useRelatedIssues: () => ({}) }));
jest.mock('@/project/main-panel/ask/hooks', () => ({
  useAIChatTools: () => ({}), AIChatToolsProvider: ({ children }) => children,
}));
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_TYPE: { EMAIL: 'email' },
  CONNECTION_PREDEFINED_COLUMN_NAME: {},
  SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES: [],
  CONNECTION_COLUMNS_WIDTH_CONFIG: {},
  CONNECTION_COLUMNS_ORDER_CONFIG: {},
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({
  ConnectionsProvider: ({ children }) => children,
  useConnectionsPage: () => ({}),
  useConnections: () => ({ connections: [{ id: 1, type: 'email' }, { id: 2, type: 'email' }] }),
}));
jest.mock('@/project/main-panel/connections/utils', () => ({
  getTableName: connection => `email_${connection.id}`,
  formatColumns: (_connection, columns) => columns,
  generateAIOptions: () => null,
  generateMarkAsOutdatedOptions: () => [],
  generateFindRelatedIssuesOption: () => null,
  generateOpenOriginalPageOption: () => null,
  generateCopyOriginalLinkOption: () => null,
}));
jest.mock('@/project/utils', () => ({
  normalizeContextMenuOptions: options => options.filter(Boolean), shouldReload: () => false,
}));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata', () => ({
  __esModule: true,
  default: require('@/sea-metadata/render').default,
  CollaboratorsProvider: ({ children }) => children,
  ...jest.requireActual('@/sea-metadata/controller-provider'),
}));
jest.mock('@/sea-metadata/components/view-toolbar', () => () => null);
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/view', () => () => {
  const { useMetadata } = require('@/sea-metadata/hooks/metadata');
  const { useSelectedRows } = require('@/sea-metadata/hooks/selected-rows');
  const { metadata, createContextMenuOptions } = useMetadata();
  const { selectedRowIds, updateSelectedRowIds } = useSelectedRows();
  const deleteSelected = () => {
    const options = createContextMenuOptions({
      table: metadata,
      selectedPosition: { rowIdx: 0 },
      rowMetrics: { idSelectedRowMap: Object.fromEntries(selectedRowIds.map(id => [id, true])) },
      rowGetterByIndex: ({ rowIndex }) => metadata.rows[rowIndex],
    });
    options.find(option => option.key === 'delete_email' || option.key === 'delete_emails').callback();
  };
  return (
    <>
      <button onClick={() => updateSelectedRowIds(metadata.rows.map(row => row._id))}>Select emails</button>
      <button onClick={() => updateSelectedRowIds(metadata.rows.filter(row => row._id !== 'keep-thread').map(row => row._id))}>Select deletable emails</button>
      <button onClick={deleteSelected}>Delete emails</button>
      <output>{JSON.stringify({ rows: metadata.rows, selectedRowIds })}</output>
    </>
  );
});

let root;
let container;
let resolveDelete;
let rejectDelete;
let dataAPI;
let serverRows;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  serverRows = { 1: ['same-thread', 'keep-thread'], 2: ['same-thread', 'keep-thread'] };
  connectionsAPI.listViews.mockResolvedValue({ data: { views: [{ _id: 'all' }], navigation: [{ _id: 'all', type: 'view' }] } });
  connectionsAPI.getView.mockResolvedValue({ data: { view: { _id: 'all', type: 'table' } } });
  connectionsAPI.getConnectionDetails.mockImplementation(async (_project, connectionID) => ({
    data: { records: serverRows[connectionID].map(id => ({ _pk: id, _id: id })), columns: [] },
  }));
  connectionsAPI.deleteConnectionEmail.mockImplementation((_project, connectionID, { thread_ids }) => new Promise((resolve, reject) => {
    resolveDelete = () => {
      serverRows[connectionID] = serverRows[connectionID].filter(id => !thread_ids.includes(id));
      resolve({ data: {} });
    };
    rejectDelete = reject;
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const CacheProbe = () => {
  dataAPI = useData();
  return null;
};
const renderConnection = async (connectionID, recordsKey = 'records', projectUuid = 'project') => {
  await act(async () => root.render(
    <DataProvider key={projectUuid} projectUuid={projectUuid}>
      <CacheProbe />
      <SeaMetadataControllerProvider>
        {connectionID != null && <Records key={recordsKey} projectUuid={projectUuid} permission="rw" connectionID={connectionID} />}
      </SeaMetadataControllerProvider>
    </DataProvider>
  ));
};
const readTable = () => JSON.parse(container.querySelector('output').textContent);
const selectEmails = () => act(() => screen.getByRole('button', { name: 'Select emails' }).click());
const startDelete = (ids = ['same-thread']) => {
  act(() => screen.getByRole('button', { name: 'Select deletable emails' }).click());
  act(() => screen.getByRole('button', { name: 'Delete emails' }).click());
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledWith('project', 1, { thread_ids: ids });
};

it.each([1, 2])('updates rows and selection when deleting %i emails from the original table', async count => {
  const ids = Array.from({ length: count }, (_, i) => `thread-${i}`);
  serverRows[1] = ids;
  await renderConnection(1);
  selectEmails();
  act(() => screen.getByRole('button', { name: 'Delete emails' }).click());

  await act(async () => resolveDelete());

  expect(readTable()).toEqual({ rows: [], selectedRowIds: [] });
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledWith('project', 1, { thread_ids: ids });
  expect(dataAPI.getTableByName('email_1').id_view_map.all.rows).toEqual([]);
  expect(toaster.success).toHaveBeenCalledWith(count === 1
    ? 'Email thread has been moved to trash.'
    : 'Email threads have been moved to trash.');
});

it('keeps connection B unchanged when deletion in connection A completes', async () => {
  await renderConnection(1);
  startDelete();
  await renderConnection(2);
  selectEmails();
  const replacement = readTable();
  const bCache = dataAPI.getTableByName('email_2');

  await act(async () => resolveDelete());

  expect(readTable()).toEqual(replacement);
  expect(replacement.selectedRowIds).toEqual(['same-thread', 'keep-thread']);
  expect(dataAPI.getTableByName('email_2')).toEqual(bCache);
  expect(dataAPI.getTableByName('email_1').id_view_map.all.rows).toEqual(['keep-thread']);
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledTimes(1);
  expect(toaster.success).toHaveBeenCalledWith('Email thread has been moved to trash.');
});

it.each([
  ['return', 1], ['return', 2], ['remount', 1], ['remount', 2],
])('removes deleted emails from a new A table and preserves other selections (%s, %i rows)', async (scenario, count) => {
  const ids = Array.from({ length: count }, (_, i) => i === 0 ? 'same-thread' : 'another-thread');
  serverRows[1] = [...ids, 'keep-thread'];
  await renderConnection(1);
  startDelete(ids);
  if (scenario === 'remount') {
    await renderConnection(null);
    await renderConnection(1, 'replacement');
  } else {
    await renderConnection(2);
    await renderConnection(1);
  }
  // Returning A is loaded from the real project cache while deletion is pending.
  expect(connectionsAPI.getConnectionDetails.mock.calls.filter(([, id]) => id === 1)).toHaveLength(1);
  selectEmails();
  expect(readTable().selectedRowIds).toEqual([...ids, 'keep-thread']);

  await act(async () => resolveDelete());

  expect(readTable().rows.map(row => row._id)).toEqual(['keep-thread']);
  expect(readTable().selectedRowIds).toEqual(['keep-thread']);
  expect(dataAPI.getTableByName('email_1').id_view_map.all.rows).toEqual(['keep-thread']);
  ids.forEach(id => expect(dataAPI.getTableByName('email_1').id_row_map[id]).toBeUndefined());
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledTimes(1);
  expect(toaster.success).toHaveBeenCalledTimes(1);
});

it('uses the updated project cache when returning A after deletion completes on B', async () => {
  await renderConnection(1);
  startDelete();
  await renderConnection(2);
  await act(async () => resolveDelete());

  await renderConnection(1);

  expect(readTable().rows.map(row => row._id)).toEqual(['keep-thread']);
  expect(dataAPI.getTableByName('email_1').id_view_map.all.rows).toEqual(['keep-thread']);
  expect(connectionsAPI.getConnectionDetails.mock.calls.filter(([, id]) => id === 1)).toHaveLength(1);
});

it('does not apply deletion results to the same connection ID in another project', async () => {
  await renderConnection(1);
  startDelete();
  await renderConnection(1, 'records', 'another-project');
  selectEmails();
  const replacement = readTable();

  await act(async () => resolveDelete());

  expect(readTable()).toEqual(replacement);
  expect(toaster.success).toHaveBeenCalledTimes(1);
});

it('reports deletion failure after switching connections without changing the replacement table', async () => {
  await renderConnection(1);
  startDelete();
  await renderConnection(2);
  selectEmails();
  const replacement = readTable();

  await act(async () => rejectDelete(new Error('Deletion failed')));

  expect(readTable()).toEqual(replacement);
  expect(toaster.danger).toHaveBeenCalledWith('Deletion failed');
  expect(toaster.success).not.toHaveBeenCalled();
});
