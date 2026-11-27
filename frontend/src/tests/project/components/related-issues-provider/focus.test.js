import React, { act } from 'react';
import { screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { connectionsAPI, ticketsAPI } from '@/project/api';
import { RelatedIssuesProvider } from '@/project/components/related-issues-provider';
import { useRelatedIssues } from '@/project/hooks/related-issues';

// Keep the real Modal, Dropdown and their focus/lifecycle handling.
jest.mock('@/components/icon', () => () => null);
jest.mock('@/components', () => ({
  ModalHeader: require('@/components/modal-header').default,
  CustomizeDropdownMenu: require('@/components/customize-dropdown-menu').default,
  IconButton: ({ title, onClick }) => <button onClick={onClick}>{title}</button>,
  IconTooltip: () => null,
  CenteredLoading: () => <span>Loading</span>,
  CenteredError: ({ children }) => <span>{children}</span>,
  EmptyTip: () => <span>No related issues</span>,
}));
jest.mock('@seafile/seafile-editor', () => ({ getPreviewContent: content => ({ previewText: content }) }));
jest.mock('@/constants', () => ({
  gettext: text => text, mediaUrl: '/', PERMISSION_TYPES: { READ_ONLY: 'r', READ_WRITE: 'rw' },
}));
jest.mock('@/project/api', () => ({
  connectionsAPI: { findRelatedRecords: jest.fn() },
  ticketsAPI: { findRelatedIssues: jest.fn() },
}));
jest.mock('@/portal/api', () => ({ portalAPI: {} }));
jest.mock('@/project/components', () => ({ ResourceDetailsDialog: require('@/project/components/resource-details-dialog').default }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: { RESOURCE_UPDATED: 'resource-updated' } }));
jest.mock('@/project/hooks/data-context', () => ({ useData: () => ({ getTableByName: () => null }) }));
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_TYPES: [], CONNECTION_TYPE: {}, SUPPORT_ROW_DETAILS_CONNECTION_TYPES: ['github_issue'],
}));
jest.mock('@/project/main-panel/connections/hooks', () => ({ useConnections: () => ({ connections: [{ id: 1, type: 'github_issue' }] }) }));
jest.mock('@/project/main-panel/connections/utils', () => ({ getTableName: () => 'github_issue_1' }));
jest.mock('@/project/main-panel/connections/components/related-issues-dialog/resolved-tag', () => () => null);
jest.mock('@/project/main-panel/connections/components/connection-record-details-in-dialog', () => {
  const React = require('react');
  const { useRelatedIssues } = require('@/project/hooks/related-issues');
  return React.forwardRef(({ onUpdateResourceDetails }, ref) => {
    const { openRelatedIssues } = useRelatedIssues();
    React.useEffect(() => {
      onUpdateResourceDetails({ record: { title: 'Record details' } });
    }, [onUpdateResourceDetails]);
    return (
      <>
        <input aria-label="Draft" defaultValue="Original draft" />
        <button onClick={() => openRelatedIssues({ row: { _id: 'record' }, connection: { id: 1 } })}>Search from details</button>
      </>
    );
  });
});
jest.mock('@/project/main-panel/knowledge-base/components', () => ({}));
jest.mock('@/project/main-panel/tickets/components/ticket-in-dialog', () => () => null);
jest.mock('@/project/utils', () => ({
  getResourceIconURL: () => '', getResourceOriginalURL: () => '', getInternalNetworkAddress: () => '',
}));
jest.mock('@/sea-metadata/utils/cell', () => ({ getCellValueByColumn: (row, column) => row?.[column?.key] }));
jest.mock('@/sea-metadata/utils/column', () => ({
  getColumnByName: (columns, name) => columns.find(column => column.name === name),
  formatWithTimezone: value => value,
}));
jest.mock('@/utils/dialog', () => ({ getDialogSize: () => 's' }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message, debounce: fn => fn } }));
jest.mock('@/project/components/resource-details-dialog/use-more-options', () => {
  const { useRelatedIssues } = require('@/project/hooks/related-issues');
  return () => {
    const { openRelatedIssues } = useRelatedIssues();
    return [{ key: 'find', label: 'Find related issues', callback: () => openRelatedIssues({ row: { _id: 'record' }, connection: { id: 1 } }) }];
  };
});

const result = { _id: 'record', connection_id: 1, type: 'github_issue', title: 'Parent result' };

describe('Related issues dialog focus with real modals', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;

  const Launcher = ({ source }) => {
    const { openRelatedIssues } = useRelatedIssues();
    return <button onClick={() => openRelatedIssues({ row: { _id: 'source' }, ...(source === 'connection' ? { connection: { id: 1 } } : {}) })}>Search</button>;
  };
  const click = async element => act(async () => {
    element.focus();
    element.click();
  });
  const escape = () => act(() => {
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Escape', code: 'Escape', keyCode: 27 }));
  });

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    connectionsAPI.findRelatedRecords.mockResolvedValue({ data: { related_records: [result] } });
    ticketsAPI.findRelatedIssues.mockResolvedValue({ data: { related_records: [result] } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it.each([
    ['connection', 'menu'], ['ticket', 'menu'],
    ['connection', 'button'], ['ticket', 'button'],
    ['connection', 'unfocused menu'], ['ticket', 'unfocused menu'],
  ])('returns through each layer with Escape from %s using a %s trigger', async (source, triggerType) => {
    act(() => root.render(<RelatedIssuesProvider projectUuid="project"><Launcher source={source} /></RelatedIssuesProvider>));
    const launcher = screen.getByRole('button', { name: 'Search' });
    await click(launcher);
    const parentSearch = screen.getByRole('dialog');
    await click(screen.getByText('Parent result'));
    const details = screen.getAllByRole('dialog')[1];
    within(details).getByRole('textbox', { name: 'Draft' }).value = 'Edited draft';
    if (triggerType !== 'button') await click(within(details).getByRole('button', { name: 'More' }));
    const trigger = triggerType === 'button'
      ? within(details).getByRole('button', { name: 'Search from details' })
      : within(details).getByRole('menuitem', { name: 'Find related issues' });
    if (triggerType === 'unfocused menu') {
      act(() => document.activeElement.blur());
      expect(document.activeElement).toBe(document.body);
      await act(async () => trigger.click());
    } else {
      await click(trigger);
    }

    expect(screen.getAllByRole('dialog')).toHaveLength(3);
    expect(screen.getAllByRole('dialog')[2].contains(document.activeElement)).toBe(true);
    escape();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(details.contains(document.activeElement)).toBe(true);
    expect(document.activeElement.closest('[aria-hidden="true"]')).toBeNull();
    if (triggerType === 'button') expect(document.activeElement).toBe(trigger);
    expect(within(details).getByRole('textbox', { name: 'Draft' }).value).toBe('Edited draft');

    escape();
    expect(screen.getAllByRole('dialog')).toEqual([parentSearch]);
    expect(parentSearch.contains(document.activeElement)).toBe(true);
    escape();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);
    expect(connectionsAPI.findRelatedRecords).toHaveBeenCalledTimes(source === 'connection' ? 2 : 1);
    expect(ticketsAPI.findRelatedIssues).toHaveBeenCalledTimes(source === 'ticket' ? 1 : 0);
  });
});
