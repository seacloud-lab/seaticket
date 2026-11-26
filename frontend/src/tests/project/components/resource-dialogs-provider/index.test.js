import React, { act, useContext } from 'react';
import { screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import ResourceDialogsProvider from '@/project/components/resource-dialogs-provider';
import { useLinkTicket } from '@/project/hooks/link-ticket';
import { useRelatedIssues } from '@/project/hooks/related-issues';
import { ResourceDialogContext } from '@/project/hooks/resource-dialog';
import { useTicketCreation } from '@/project/hooks/ticket-creation';

const mockDialogProps = jest.fn();

jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_WRITE: 'rw' } }));
jest.mock('@/portal/api', () => ({ portalAPI: {} }));
jest.mock('@/project/api', () => ({ connectionsAPI: {} }));
jest.mock('@/project/constants', () => ({ EVENT_BUS_TYPE: {} }));
jest.mock('@/project/hooks', () => ({ useData: () => ({ getTableByName: () => null }) }));
jest.mock('@/project/main-panel/connections/components/create-ticket-dialog', () => props => <MockDialog name="create-ticket" {...props} />);
jest.mock('@/project/main-panel/connections/components/related-issues-dialog', () => props => <MockDialog name="connection-related" {...props} />);
jest.mock('@/project/main-panel/tickets/components/tickets-dialog', () => props => <MockDialog name="link-ticket" {...props} />);
jest.mock('@/project/main-panel/tickets/components/related-issues-dialog', () => props => <MockDialog name="ticket-related" {...props} />);
jest.mock('@/project/main-panel/tickets/components/create-kb-record-dialog', () => props => <MockDialog name="kb" {...props} />);
jest.mock('@/project/main-panel/tickets/components/create-task-dialog', () => props => <MockDialog name="task" {...props} />);
jest.mock('@/project/main-panel/connections/constants', () => ({
  CONNECTION_PREDEFINED_COLUMN_NAME: { LINKED_TICKET: 'linked_ticket' },
  CONNECTION_TYPE: { GENERAL_TASK: 'general_task' },
}));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/tickets/utils', () => ({ convertTicketToKb: ticket => ticket, convertTicketToTask: ticket => ticket }));
jest.mock('@/sea-metadata/utils/cell', () => ({}));
jest.mock('@/sea-metadata/utils/column', () => ({ getColumnByName: (columns, name) => columns.find(column => column.name === name) }));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/utils/utils', () => ({}));

const MockDialog = ({ name, ...props }) => {
  mockDialogProps(name, props);
  const [draft, setDraft] = React.useState('Empty draft');
  const { createTicket, linkAnExistingTicket } = useLinkTicket();
  const { openRelatedIssues } = useRelatedIssues();
  const { createKnowledgeBaseRecord, createTask } = useTicketCreation();
  const policy = useContext(ResourceDialogContext);
  const row = { _id: '7', title: 'Resource' };
  const columns = [{ key: 'link', name: 'linked_ticket' }];
  return (
    <div data-testid={name}>
      <span>{policy.isSupportPortal ? 'Portal' : 'Project'}</span>
      <span>{policy.isReadonly ? 'Read only' : 'Writable'}</span>
      <span data-testid={`${name}-draft`}>{draft}</span>
      <button onClick={() => setDraft('Edited draft')}>Edit draft</button>
      <button onClick={() => createTicket({ row, columns })}>Create ticket</button>
      <button onClick={() => linkAnExistingTicket({ row, columns })}>Link ticket</button>
      <button onClick={() => openRelatedIssues({ row })}>Related tickets</button>
      <button onClick={() => openRelatedIssues({ row, connection: { id: 1 } })}>Related connection issues</button>
      <button onClick={() => createKnowledgeBaseRecord({ ticket: row, columns })}>Create KB</button>
      <button onClick={() => createTask({ ticket: row, columns })}>Create task</button>
    </div>
  );
};

describe('Shared resource dialog workflows', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;
  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
  const render = (props = {}) => act(() => root.render(
    <ResourceDialogsProvider projectUuid="project" {...props}><MockDialog name="app" /></ResourceDialogsProvider>
  ));
  const click = (dialog, button) => act(() => within(screen.getByTestId(dialog)).getByRole('button', { name: button, exact: true }).click());
  const dialogProps = name => mockDialogProps.mock.calls.filter(([dialog]) => dialog === name).slice(-1)[0][1];

  it.each([
    ['create-ticket', 'Create ticket', 'onClose'],
    ['link-ticket', 'Link ticket', 'onToggle'],
    ['ticket-related', 'Related tickets', 'onClose'],
    ['connection-related', 'Related connection issues', 'onClose'],
    ['task', 'Create task', 'onClose'],
    ['kb', 'Create KB', 'onClose'],
  ])('ignores repeated stale closes after reopening %s for the same resource', (name, action, closeProp) => {
    render();
    click('app', action);
    const oldClose = dialogProps(name)[closeProp];
    act(() => oldClose());
    expect(screen.queryByTestId(name)).toBeNull();
    act(() => oldClose());

    click('app', action);
    act(() => { oldClose(); oldClose(); });
    expect(screen.getByTestId(name)).toBeTruthy();

    const currentClose = dialogProps(name)[closeProp];
    act(() => { currentClose(); currentClose(); });
    expect(screen.queryByTestId(name)).toBeNull();
  });

  it.each([
    ['create-ticket', 'Create ticket'], ['link-ticket', 'Link ticket'],
  ])('starts a fresh form when another %s operation replaces an open dialog', (name, action) => {
    render();
    click('app', action);
    click(name, 'Edit draft');
    expect(screen.getByTestId(`${name}-draft`).textContent).toBe('Edited draft');

    click('app', action);
    expect(screen.getByTestId(`${name}-draft`).textContent).toBe('Empty draft');
  });

  it('makes every operation context available to dialogs opened by other workflows', () => {
    render();
    click('app', 'Create ticket');
    click('create-ticket', 'Related tickets');
    click('ticket-related', 'Create task');
    click('task', 'Link ticket');
    click('link-ticket', 'Related connection issues');
    click('connection-related', 'Create KB');
    expect(screen.getByTestId('kb')).toBeTruthy();
    click('kb', 'Create ticket');
    expect(screen.getByTestId('create-ticket')).toBeTruthy();
  });

  it('passes the Portal policy to workflow dialogs and their descendants', () => {
    render({ isSupportPortal: true });
    click('app', 'Related tickets');
    expect(within(screen.getByTestId('ticket-related')).getByText('Portal')).toBeTruthy();
    expect(within(screen.getByTestId('ticket-related')).getByText('Read only')).toBeTruthy();
  });
});
