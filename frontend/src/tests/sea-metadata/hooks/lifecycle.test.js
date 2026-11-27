import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import toaster from '@/components/toaster';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';
import { MetadataProvider } from '@/sea-metadata/hooks/metadata';

const mockStores = [];
let mockCollaborators;
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components/toaster', () => ({ danger: jest.fn(), success: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => mockCollaborators }));
jest.mock('@/sea-metadata/hooks/selected-rows', () => ({ useSelectedRows: () => ({ selectedRowIds: [] }) }));
jest.mock('@/sea-metadata/store', () => class {
  constructor(props) {
    Object.assign(this, props);
    this.data = { rows: [], columns: [], view: {} };
    mockStores.push(this);
  }
  initStartIndex() {}
  load() {
    this.collaboratorsAtLoad = this.collaborators;
    return Promise.resolve();
  }
  destroy() { this.destroyed = true; this.data = null; }
});

const Table = ({ context, primary, ...props }) => (
  <section ref={node => context.root = node} data-sea-metadata-instance={context.id} data-sea-metadata-primary={primary || undefined} tabIndex={-1}>
    <SeaMetadataContextProvider context={context}>
      <MetadataProvider {...props} />
    </SeaMetadataContextProvider>
  </section>
);
const makeContext = id => {
  const context = createMetadataContext();
  context.id = id;
  return context;
};

let root;
let container;
let context;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  mockStores.length = 0;
  mockCollaborators = { collaborators: [], collaboratorsCache: {} };
  context = makeContext('main');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  context.destroy();
  container.remove();
});

it('initializes the next view with current collaborators and data when they change together', async () => {
  await act(async () => root.render(<Table context={context} viewID="first" />));
  const oldStore = mockStores[0];
  const tagsData = { rows: [{ _id: 'tag' }] };
  const typesData = { rows: [{ _id: 'type' }] };
  const customersData = { rows: [{ _id: 'customer' }] };
  mockCollaborators = {
    collaborators: [{ email: 'collaborator@example.com' }],
    collaboratorsCache: { cached: { email: 'cached@example.com' } },
  };

  await act(async () => root.render(<Table context={context} viewID="next" tagsData={tagsData} typesData={typesData} customersData={customersData} />));

  const next = mockStores[1];
  expect(oldStore.destroyed).toBe(true);
  expect(next).toMatchObject({ viewId: 'next', tagsData, typesData, customersData });
  expect(next.collaboratorsAtLoad).toEqual([...mockCollaborators.collaborators, ...Object.values(mockCollaborators.collaboratorsCache)]);
});

it('keeps error notifications available after switching views without using old view callbacks', async () => {
  await act(async () => root.render(<Table context={context} viewID="first" />));
  const oldStore = mockStores[0];
  await act(async () => root.render(<Table context={context} viewID="next" />));

  oldStore.onOperationError('Delete failed');

  expect(toaster.danger).toHaveBeenCalledWith('Delete failed');
  expect(mockStores[1].destroyed).toBeUndefined();
});

const search = (target = document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'f', keyCode: 70, which: 70, ctrlKey: true });
  act(() => target.dispatchEvent(event));
  return event;
};

it('lets the primary page table handle search before any table receives focus', async () => {
  const onSearch = jest.fn();
  context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, onSearch);
  await act(async () => root.render(<Table context={context} primary />));

  expect(document.activeElement).toBe(document.body);
  expect(search().defaultPrevented).toBe(true);
  expect(onSearch).toHaveBeenCalledTimes(1);
});

it('routes a focused dialog table search only to that table and blocks body fallback while the dialog is open', async () => {
  const dialog = makeContext('dialog-table');
  const mainSearch = jest.fn();
  const dialogSearch = jest.fn();
  context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, mainSearch);
  dialog.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, dialogSearch);
  await act(async () => root.render(
    <>
      <Table context={context} primary />
      <div role="dialog"><Table context={dialog} primary /></div>
    </>
  ));

  expect(search().defaultPrevented).toBe(false);
  act(() => dialog.root.focus());
  expect(search(dialog.root).defaultPrevented).toBe(true);
  expect(mainSearch).not.toHaveBeenCalled();
  expect(dialogSearch).toHaveBeenCalledTimes(1);
});

it.each(['input', 'textarea', 'editable'])('does not steal search from an outside %s', async tag => {
  const onSearch = jest.fn();
  context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, onSearch);
  await act(async () => root.render(<Table context={context} primary />));
  const editor = document.createElement(tag === 'editable' ? 'div' : tag);
  if (tag === 'editable') { editor.contentEditable = 'true'; editor.tabIndex = 0; }
  container.appendChild(editor);
  editor.focus();
  expect(search(editor).defaultPrevented).toBe(false);
  expect(search().defaultPrevented).toBe(false);
  expect(onSearch).not.toHaveBeenCalled();
});

it('does not choose an arbitrary default when multiple primary page tables exist', async () => {
  const other = makeContext('other');
  const onSearch = jest.fn();
  context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, onSearch);
  other.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, onSearch);
  await act(async () => root.render(<><Table context={context} primary /><Table context={other} primary /></>));
  expect(search().defaultPrevented).toBe(false);
  expect(onSearch).not.toHaveBeenCalled();
  act(() => context.root.focus());
  expect(search(context.root).defaultPrevented).toBe(true);
  expect(onSearch).toHaveBeenCalledTimes(1);
});

it.each(['hidden', 'aria-hidden', 'display'])('ignores a dialog hidden via %s when choosing the page search target', async mode => {
  const onSearch = jest.fn();
  context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, onSearch);
  await act(async () => root.render(<Table context={context} primary />));
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  if (mode === 'hidden') dialog.hidden = true;
  if (mode === 'aria-hidden') dialog.setAttribute('aria-hidden', 'true');
  if (mode === 'display') dialog.style.display = 'none';
  container.appendChild(dialog);
  expect(search().defaultPrevented).toBe(true);
  expect(onSearch).toHaveBeenCalledTimes(1);
});
