import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider, useData } from '@/project/hooks/data';

jest.mock('@/api/user-api', () => ({}));
jest.mock('@/constants', () => ({ username: 'user@example.com' }));
jest.mock('@/components/common/notification/hooks/notification', () => ({ NotificationProvider: ({ children }) => children }));
jest.mock('@/sea-metadata', () => ({ CollaboratorsProvider: ({ children }) => children }));
jest.mock('@/sea-metadata/utils/row', () => ({ convertRowToKeyValue: row => row }));
jest.mock('@/project/api/project-api', () => ({}));
jest.mock('@/project/constants', () => ({ EMPTY_TABLE: {} }));
jest.mock('@/project/main-panel/analyze/hooks/analyze-task', () => ({ AnalyzeTaskProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/ask/hooks', () => ({ AIChatToolsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/connections/constants', () => ({ CONNECTION_PREDEFINED_COLUMN_NAME: {} }));
jest.mock('@/project/main-panel/connections/hooks', () => ({ ConnectionsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/knowledge-base/constants', () => ({}));
jest.mock('@/project/main-panel/portal-issues/hooks', () => ({ PortalIssuesMetadataProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tags/hooks/tags', () => ({ TagsProvider: ({ children }) => children }));
jest.mock('@/project/main-panel/tickets/hooks', () => ({
  MetadataProvider: ({ children }) => children,
  CloseLinkedIssuesProvider: ({ children }) => children,
}));
jest.mock('@/project/main-panel/tickets/constants', () => ({
  TICKET_TABLE_NAME: 'tickets',
  TICKET_STATE: { OPEN: 'open', CLOSED: 'closed' },
  PREDEFINED_TICKET_COLUMN_NAME: {},
  MY_TICKETS_VIEW_IDS: { assigned: {}, created: {} },
}));
jest.mock('@/project/utils', () => ({}));

describe('Project linked row cache updates', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;
  let container;
  let dataAPI;

  const Consumer = () => {
    dataAPI = useData();
    return null;
  };

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<DataProvider><Consumer /></DataProvider>); });
    act(() => { dataAPI.updateTable('tickets', {
      id_row_map: { A: { links: ['existing'] } },
      key_column_map: { links: { key: 'links', name: 'linked_connection_records' } },
      linked_records: {},
    }); });
  });

  afterEach(() => { act(() => root.unmount()); });

  it.each([[1, 2], [2, 1]])('merges batched insertions %j, %j against the latest cached row', (first, last) => {
    const insert = dataAPI.insertRowByLink;
    act(() => {
      [first, last].forEach(id => {
        const key = `2_${id}`;
        insert('tasks', 'tickets', { [key]: `Task ${id}` }, 'A', row => ({
          links: Array.from(new Set([...row.links, key])),
        }));
      });
    });

    const table = dataAPI.getTableByName('tickets');
    expect(table.id_row_map.A.links).toEqual(['existing', `2_${first}`, `2_${last}`]);
    expect(table.linked_records).toEqual({ '2_1': 'Task 1', '2_2': 'Task 2' });
  });

  it('continues accepting object updates', () => {
    act(() => { dataAPI.insertRowByLink('tasks', 'tickets', {}, 'A', { title: 'Updated title' }); });

    expect(dataAPI.getTableByName('tickets').id_row_map.A).toEqual({ links: ['existing'], title: 'Updated title' });
  });
});
