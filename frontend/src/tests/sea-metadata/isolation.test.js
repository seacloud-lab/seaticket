import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { useSeaMetadataController } from '@/sea-metadata/controller-provider';
import SeaMetadata from '@/sea-metadata/render';
import eventBus from '@/utils/event-bus';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({ CenteredLoading: () => <span>Loading</span>, toaster: { danger: jest.fn() } }));
jest.mock('@/components/toaster', () => ({ danger: jest.fn(), success: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata/components/view-toolbar', () => () => null);
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/store', () => class {
  constructor({ context, viewId }) { this.context = context; this.viewId = viewId; this.data = null; }
  initStartIndex() {}
  async load() {
    const res = await this.context.getMetadata({ view_id: this.viewId });
    if (this.destroyed) return;
    this.data = { rows: res.data.rows, columns: [], view: { _id: this.viewId, groupbys: [] } };
  }
  reload() { return this.load(); }
  destroy() { this.destroyed = true; this.data = null; }
  modifyLocalRow(id, update) {
    this.data = { ...this.data, rows: this.data.rows.map(row => row._id === id ? { ...row, ...update } : row) };
    this.context.eventBus.dispatch('local-data-changed');
  }
});
jest.mock('@/sea-metadata/view', () => () => {
  const { useSeaMetadataContext } = require('@/sea-metadata/context-provider');
  const { useMetadata } = require('@/sea-metadata/hooks/metadata');
  const { useSelectedRows } = require('@/sea-metadata/hooks/selected-rows');
  const context = useSeaMetadataContext();
  const { metadata } = useMetadata();
  const { selectedRowIds, updateSelectedRowIds } = useSelectedRows();
  return (
    <div>
      <button data-owner={context.id} onClick={() => updateSelectedRowIds(['same-row'])}>select</button>
      <output>{JSON.stringify({ rows: metadata.rows, selectedRowIds, permission: context.getPermission(), setting: context.getSetting('canPasteCells'), translation: context.translate('{Rows} deleted') })}</output>
    </div>
  );
});

const apiFor = title => ({
  getViews: jest.fn(async () => ({ data: { views: [{ _id: 'same-view' }], navigation: [{ _id: 'same-view', type: 'view' }] } })),
  getView: jest.fn(async () => ({ data: { view: { _id: 'same-view' } } })),
  getMetadata: jest.fn(async () => ({ data: { rows: [{ _id: 'same-row', title }] } })),
});

let root;
let container;
const handles = {};
const Remote = ({ metadataID }) => {
  handles[metadataID] = useSeaMetadataController(metadataID);
  return null;
};
const output = id => JSON.parse(document.getElementById(id).querySelector('output').textContent);
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  window.localStorage.clear();
  history.replaceState(null, '', '/?view=other-view&keep=yes');
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('isolates a page and dialog with identical view and row IDs, using controllers from unrelated components', async () => {
  const mainAPI = apiFor('main');
  const dialogAPI = apiFor('dialog');
  const mainRef = React.createRef();
  const dialogRef = React.createRef();
  const render = showDialog => (
    <>
      <Remote metadataID="isolation-main" /><Remote metadataID="isolation-dialog" />
      <section id="main"><SeaMetadata ref={mainRef} metadataID="isolation-main" api={mainAPI} localStorageNamePrefix="same" /></section>
      {showDialog && <section id="dialog"><SeaMetadata ref={dialogRef} metadataID="isolation-dialog" api={dialogAPI} localStorageNamePrefix="same" /></section>}
    </>
  );
  await act(async () => root.render(render(true)));
  expect(output('main').rows[0].title).toBe('main');
  expect(output('dialog').rows[0].title).toBe('dialog');
  const main = handles['isolation-main'];
  const dialog = handles['isolation-dialog'];
  expect(mainAPI.getMetadata).toHaveBeenCalledTimes(1);
  await act(async () => dialog.reload());
  expect(dialogAPI.getMetadata).toHaveBeenCalledTimes(2);
  expect(mainAPI.getMetadata).toHaveBeenCalledTimes(1);
  act(() => document.querySelector('#dialog button').click());
  expect(dialog.getSelectedRowIds()).toEqual(['same-row']);
  expect(main.getSelectedRowIds()).toEqual([]);
  act(() => main.events.dispatch(EVENT_BUS_TYPE.SELECT_NONE));
  expect(dialog.getSelectedRowIds()).toEqual(['same-row']);
  main.storage.setItem('sorts', ['main']);
  dialog.storage.setItem('sorts', ['dialog']);
  expect(main.storage.getItem('sorts')).toEqual(['main']);
  act(() => eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE));
  expect(dialog.getSelectedRowIds()).toEqual(['same-row']);
  expect(new URLSearchParams(location.search).get('view')).toBe('other-view');
  expect(mainRef.current.createMoreOptions({ _id: 'same-row' })).toEqual([]);
  await act(async () => root.render(render(false)));
  expect(dialog.getData()).toBeNull();
  expect(main.getData().rows[0].title).toBe('main');
  await act(async () => main.reload());
  expect(mainAPI.getMetadata).toHaveBeenCalledTimes(2);
  await act(async () => root.render(render(true)));
  expect(dialog.storage.getItem('sorts')).toEqual(['dialog']);
});

it('updates API, permissions, settings and translations without replacing the controller', async () => {
  const first = apiFor('first'); const second = apiFor('second');
  const render = (api, permission, settings, t) => (
    <>
      <Remote metadataID="isolation-reactive" />
      <section id="main"><SeaMetadata metadataID="isolation-reactive" api={api} permission={permission} settings={settings} t={t} /></section>
    </>
  );
  await act(async () => root.render(render(first, 'r', { canPasteCells: false }, { Rows: 'Tickets' })));
  const controller = handles['isolation-reactive'];
  expect(output('main')).toMatchObject({ permission: 'r', setting: false, translation: 'Tickets deleted' });
  await act(async () => root.render(render(second, 'rw', undefined, { Rows: 'Issues' })));
  expect(handles['isolation-reactive']).toBe(controller);
  expect(output('main')).toMatchObject({ permission: 'rw', setting: true, translation: 'Issues deleted' });
  await act(async () => controller.reload());
  expect(controller.getData().rows[0].title).toBe('second');
  expect(first.getMetadata).toHaveBeenCalledTimes(1);
});

it('cleans up and rebinds correctly under React StrictMode', async () => {
  const api = apiFor('strict');
  await act(async () => root.render(<React.StrictMode><Remote metadataID="isolation-strict" /><SeaMetadata metadataID="isolation-strict" api={api} /></React.StrictMode>));
  expect(handles['isolation-strict'].getData().rows[0].title).toBe('strict');
  await act(async () => handles['isolation-strict'].reload());
  expect(handles['isolation-strict'].getData().rows[0].title).toBe('strict');
});

it('uses separate URL parameters and leaves disabled tables out of URL selection', async () => {
  const mainAPI = apiFor('main'); const dialogAPI = apiFor('dialog');
  await act(async () => root.render(
    <>
      <SeaMetadata metadataID="isolation-url-main" api={mainAPI} isShowViewInURL />
      <SeaMetadata metadataID="isolation-url-dialog" api={dialogAPI} isShowViewInURL viewURLParam="dialogView" />
    </>
  ));
  expect(new URLSearchParams(location.search).get('view')).toBe('same-view');
  expect(new URLSearchParams(location.search).get('dialogView')).toBe('same-view');
  expect(new URLSearchParams(location.search).get('keep')).toBe('yes');
});

it.each([
  ['enabling URL synchronization', { isShowViewInURL: false }, { isShowViewInURL: true }, 'view'],
  ['changing the URL parameter', { isShowViewInURL: true }, { isShowViewInURL: true, viewURLParam: 'dialogView' }, 'dialogView'],
])('reads the requested view before writing the URL when %s', async (_name, initialProps, nextProps, parameter) => {
  const api = apiFor('main');
  const viewsResponse = { data: {
    views: [{ _id: 'same-view' }, { _id: 'other-view' }],
    navigation: [{ _id: 'same-view', type: 'view' }, { _id: 'other-view', type: 'view' }],
  } };
  api.getViews.mockResolvedValue(viewsResponse);
  history.replaceState(null, '', '/?view=same-view&dialogView=other-view&keep=yes');
  const metadataRef = React.createRef();
  const render = props => <SeaMetadata ref={metadataRef} api={api} {...props} />;
  await act(async () => root.render(render(initialProps)));
  expect(metadataRef.current.getData().view._id).toBe('same-view');

  const params = new URLSearchParams(location.search);
  params.set(parameter, 'other-view');
  history.replaceState(null, '', '/?' + params.toString());
  let resolveViews;
  api.getViews.mockImplementationOnce(() => new Promise(resolve => { resolveViews = resolve; }));
  await act(async () => root.render(render(nextProps)));
  expect(new URLSearchParams(location.search).get(parameter)).toBe('other-view');
  await act(async () => resolveViews(viewsResponse));

  expect(metadataRef.current.getData().view._id).toBe('other-view');
  expect(new URLSearchParams(location.search).get(parameter)).toBe('other-view');
  expect(new URLSearchParams(location.search).get('keep')).toBe('yes');
});

it('does not write a stale view to the URL if loading the new configuration fails', async () => {
  const api = apiFor('main');
  const render = enabled => <SeaMetadata api={api} isShowViewInURL={enabled} />;
  await act(async () => root.render(render(false)));
  api.getViews.mockRejectedValueOnce(new Error('Cannot load views'));
  await act(async () => root.render(render(true)));
  expect(new URLSearchParams(location.search).get('view')).toBe('other-view');
  expect(new URLSearchParams(location.search).get('keep')).toBe('yes');
});

it('restores body search for the primary page while keeping dialog search scoped', async () => {
  const mainAPI = apiFor('main');
  const dialogAPI = apiFor('dialog');
  const render = showDialog => (
    <>
      <Remote metadataID="search-main" /><Remote metadataID="search-dialog" />
      <SeaMetadata metadataID="search-main" api={mainAPI} storageNamespace="primary" />
      {showDialog && <section role="dialog"><SeaMetadata metadataID="search-dialog" api={dialogAPI} storageNamespace="primary" /></section>}
    </>
  );
  await act(async () => root.render(render(false)));
  const mainSearch = jest.fn();
  const dialogSearch = jest.fn();
  const stopMain = handles['search-main'].events.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, mainSearch);
  const stopDialog = handles['search-dialog'].events.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, dialogSearch);
  const search = target => act(() => target.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'f', keyCode: 70, which: 70, ctrlKey: true, bubbles: true, cancelable: true,
  })));

  search(document.body);
  expect(mainSearch).toHaveBeenCalledTimes(1);
  await act(async () => root.render(render(true)));
  search(document.body);
  expect(mainSearch).toHaveBeenCalledTimes(1);
  search(document.querySelector('[role="dialog"] button'));
  expect(dialogSearch).toHaveBeenCalledTimes(1);
  expect(mainSearch).toHaveBeenCalledTimes(1);
  stopMain(); stopDialog();
});

it('rebinds an ID change and preserves the original controller as a safe absent handle', async () => {
  const firstAPI = apiFor('first'); const nextAPI = apiFor('next');
  const render = (metadataID, api) => <><Remote metadataID={metadataID} /><SeaMetadata metadataID={metadataID} api={api} /></>;
  await act(async () => root.render(render('isolation-before', firstAPI)));
  const before = handles['isolation-before'];
  await act(async () => root.render(render('isolation-after', nextAPI)));
  expect(before.getData()).toBeNull();
  before.reload();
  expect(firstAPI.getMetadata).toHaveBeenCalledTimes(1);
  expect(handles['isolation-after'].getData().rows[0].title).toBe('next');
});
