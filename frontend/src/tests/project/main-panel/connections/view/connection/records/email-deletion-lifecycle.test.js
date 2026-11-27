import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { toaster } from '@/components';
import { connectionsAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import Records from '@/project/main-panel/connections/view/connection/records';
import { SeaMetadataControllerProvider } from '@/sea-metadata/controller-provider';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({
  CenteredLoading: () => null,
  toaster: { notify: jest.fn(), closeAll: jest.fn(), success: jest.fn(), danger: jest.fn() },
}));
jest.mock('@/components/toaster', () => ({ success: jest.fn(), danger: jest.fn() }));
jest.mock('@/models/user', () => jest.fn());
jest.mock('@/project/api', () => ({ connectionsAPI: { deleteConnectionEmail: jest.fn() } }));
jest.mock('@/project/components/resource-details-dialog', () => () => null);
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}), useMetadata: () => ({}) }));
jest.mock('@/project/hooks/link-ticket', () => ({
  useLinkedTicketUpdate: () => {},
  useLinkTicket: () => ({ generateConnectionLinkTicketOptions: () => [] }),
}));
jest.mock('@/project/hooks/related-issues', () => ({ useRelatedIssues: () => ({}) }));
jest.mock('@/project/hooks/resource-dialog', () => ({ useResourceUpdate: () => {} }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ useAIChatTools: () => ({}) }));
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_TYPE: { EMAIL: 'email' },
  CONNECTION_PREDEFINED_COLUMN_NAME: {},
  SUPPORT_MODIFY_CONNECTION_RECORDS_TYPES: [],
  CONNECTION_COLUMNS_WIDTH_CONFIG: {},
  CONNECTION_COLUMNS_ORDER_CONFIG: {},
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({
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
jest.mock('@/project/utils', () => ({ normalizeContextMenuOptions: options => options.filter(Boolean) }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata', () => ({
  __esModule: true,
  default: require('@/sea-metadata/render').default,
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
      <button onClick={deleteSelected}>Delete emails</button>
      <output>{JSON.stringify({ rows: metadata.rows, selectedRowIds })}</output>
    </>
  );
});

let root;
let container;
let resolveDelete;
let rejectDelete;
let deleteRows;
let dataAPI;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  deleteRows = jest.fn((_table, _ids, request) => request());
  dataAPI = {
    getTableViews: async () => ({ data: { views: [{ _id: 'all' }], navigation: [{ _id: 'all', type: 'view' }] } }),
    getTableView: async () => ({ data: { view: { _id: 'all', type: 'table' } } }),
    getMetadata: async () => ({ data: { records: [{ _id: 'same-thread' }], columns: [] } }),
    deleteRows,
  };
  useData.mockReturnValue(dataAPI);
  connectionsAPI.deleteConnectionEmail.mockReturnValue(new Promise((resolve, reject) => {
    resolveDelete = resolve;
    rejectDelete = reject;
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const renderConnection = async (connectionID, recordsKey = 'records') => {
  await act(async () => root.render(
    <SeaMetadataControllerProvider>
      <Records key={recordsKey} projectUuid="project" permission="rw" connectionID={connectionID} />
    </SeaMetadataControllerProvider>
  ));
};
const readTable = () => JSON.parse(container.querySelector('output').textContent);
const selectEmails = () => act(() => screen.getByRole('button', { name: 'Select emails' }).click());
const startDelete = () => {
  selectEmails();
  act(() => screen.getByRole('button', { name: 'Delete emails' }).click());
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledWith('project', 1, { thread_ids: ['same-thread'] });
  expect(deleteRows).toHaveBeenCalledWith('email_1', ['same-thread'], expect.any(Function));
};

it.each([1, 2])('updates rows and selection when deleting %i emails from the original table', async count => {
  const rows = Array.from({ length: count }, (_, i) => ({ _id: `thread-${i}` }));
  useData.mockReturnValue({
    ...dataAPI,
    getMetadata: async () => ({ data: { records: rows, columns: [] } }),
  });
  await renderConnection(1);
  selectEmails();
  act(() => screen.getByRole('button', { name: 'Delete emails' }).click());

  await act(async () => resolveDelete({ data: {} }));

  expect(readTable()).toEqual({ rows: [], selectedRowIds: [] });
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledWith('project', 1, { thread_ids: rows.map(row => row._id) });
  expect(toaster.success).toHaveBeenCalledWith(count === 1
    ? 'Email thread has been moved to trash.'
    : 'Email threads have been moved to trash.');
});

it.each(['switch', 'return', 'remount'])('preserves the replacement table after a pending deletion (%s)', async scenario => {
  await renderConnection(1);
  startDelete();
  if (scenario === 'remount') {
    await act(async () => root.render(<SeaMetadataControllerProvider />));
    await renderConnection(1, 'replacement');
  } else {
    await renderConnection(2);
    if (scenario === 'return') await renderConnection(1);
  }
  selectEmails();
  const replacement = readTable();
  expect(replacement.rows.map(row => row._id)).toEqual(['same-thread']);
  expect(replacement.selectedRowIds).toEqual(['same-thread']);

  await act(async () => resolveDelete({ data: {} }));

  expect(readTable()).toEqual(replacement);
  expect(connectionsAPI.deleteConnectionEmail).toHaveBeenCalledTimes(1);
  expect(toaster.success).toHaveBeenCalledWith('Email thread has been moved to trash.');
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
