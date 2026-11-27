import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CustomersTables from '@/project/main-panel/portal-customers-users/customers-tables';
import UsersTable from '@/project/main-panel/portal-customers-users/users-table';
import { createSeaMetadataController } from '@/sea-metadata/controller';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({ CenteredLoading: () => null, toaster: { danger: jest.fn() } }));
jest.mock('@/components/toaster', () => ({ danger: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata', () => ({
  __esModule: true,
  default: require('@/sea-metadata/render').default,
  ...jest.requireActual('@/sea-metadata/controller-provider'),
}));
jest.mock('@/sea-metadata/components/view-toolbar', () => () => null);
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/store', () => class {
  constructor({ context, viewId }) { this.context = context; this.viewId = viewId; }
  initStartIndex() {}
  async load() {
    const view = await this.context.getView(this.viewId);
    const metadata = await this.context.getMetadata({ view_id: this.viewId });
    if (!this.destroyed) this.data = { ...metadata.data, view: view.data.view };
  }
  destroy() { this.destroyed = true; this.data = null; }
});
jest.mock('@/sea-metadata/view', () => () => {
  const { useMetadata } = require('@/sea-metadata/hooks/metadata');
  return <output>{JSON.stringify(useMetadata().metadata)}</output>;
});

let root;
let container;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const tables = [
  {
    name: 'customers', Component: CustomersTables, prop: 'customers',
    initial: { id: 1, name: 'Customer', updated_at: 'first' },
    changed: { id: 1, name: 'Updated customer', updated_at: 'second' },
  },
  {
    name: 'users', Component: UsersTable, prop: 'users',
    initial: { name: 'User', email: 'user@example.com', activated: true },
    changed: { name: 'Updated user', email: 'user@example.com', activated: false },
  },
];

it.each(tables)('preserves $name settings after editing records and isolates projects', async ({ name, Component, prop, initial, changed }) => {
  const render = (projectUuid, record) => <Component projectUuid={projectUuid} {...{ [prop]: [record] }} />;
  await act(async () => root.render(render('project-a', initial)));
  const controller = createSeaMetadataController(`project-project-a-portal-${name}-main`);
  expect(controller.getData().rows[0].name).toBe(initial.name);
  const sorts = [{ column_key: 'name', sort_type: 'up' }];
  const widths = { name: 480 };
  controller.storage.setItem('sorts', sorts);
  controller.storage.setItem('columns_width', widths);
  const storageKey = window.localStorage.key(0);

  await act(async () => root.render(render('project-a', changed)));

  expect(controller.getData().rows[0].name).toBe(changed.name);
  expect(controller.getData().view.sorts).toEqual(sorts);
  expect(controller.storage.getItem('columns_width')).toEqual(widths);
  expect(window.localStorage.length).toBe(1);
  expect(window.localStorage.key(0)).toBe(storageKey);

  await act(async () => root.render(render('project-b', changed)));
  const other = createSeaMetadataController(`project-project-b-portal-${name}-main`);
  expect(controller.getData()).toBeNull();
  expect(other.getData().view.sorts).toEqual([]);
  expect(other.storage.getItem('columns_width')).toBeUndefined();

  await act(async () => root.render(render('project-a', changed)));
  expect(controller.getData().view.sorts).toEqual(sorts);
  expect(controller.storage.getItem('columns_width')).toEqual(widths);
});

it.each(tables)('respects the explicit $name metadata ID', async ({ Component, prop, initial }) => {
  await act(async () => root.render(<Component projectUuid="project" metadataID="custom-table" {...{ [prop]: [initial] }} />));
  expect(createSeaMetadataController('custom-table').getData().rows[0].name).toBe(initial.name);
});
