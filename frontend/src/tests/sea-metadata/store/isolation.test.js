import Store from '@/sea-metadata/store';
import { EventBus } from '@/utils/event-bus';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/sea-metadata/models', () => ({
  Metadata: class { constructor(data) { Object.assign(this, data); this.row_ids = data.rows.map(row => row._id); } },
  Row: class { constructor(data) { Object.assign(this, data); } },
}));
jest.mock('@/sea-metadata/utils/column', () => ({ normalizeColumns: columns => columns }));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/sea-metadata/store/data-processor', () => class { run() {} });
jest.mock('@/sea-metadata/store/local-operator', () => jest.fn());
jest.mock('@/sea-metadata/store/server-operator', () => class { destroy() {} });
jest.mock('@/sea-metadata/store/operations', () => ({}));

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const setup = (props = {}) => {
  const context = {
    getMetadata: jest.fn(), getView: jest.fn(), getUsername: () => 'owner',
    localStorage: { getItem: jest.fn() }, eventBus: new EventBus(),
  };
  return { context, store: new Store({ context, viewId: 'same-view', ...props }) };
};
const response = title => ({ data: { rows: [{ _id: 'row', title }], columns: [] } });

it('ignores a metadata response after its Store is destroyed', async () => {
  const { store, context } = setup();
  const request = deferred();
  context.getMetadata.mockReturnValue(request.promise);
  const loaded = store.loadMetadata({}, 100);
  store.destroy();
  request.resolve(response('late'));
  await loaded;
  expect(store.data).toBeNull();
  expect(context.localStorage.getItem).not.toHaveBeenCalled();
});

it('accepts only the newest reload response and keeps another Store independent', async () => {
  const first = setup(); const second = setup();
  const slow = deferred(); const fast = deferred();
  first.context.getMetadata.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
  second.context.getMetadata.mockResolvedValue(response('other'));
  const oldLoad = first.store.loadMetadata({}, 100);
  const newLoad = first.store.loadMetadata({}, 100, true);
  await second.store.loadMetadata({}, 100);
  fast.resolve(response('new')); await newLoad;
  slow.resolve(response('old')); await oldLoad;
  expect(first.store.data.rows[0].title).toBe('new');
  expect(second.store.data.rows[0].title).toBe('other');
  first.store.destroy(); second.store.destroy();
});

it('does not append a pending pagination response to reloaded data', async () => {
  const { store, context } = setup();
  context.getMetadata.mockResolvedValueOnce(response('initial'));
  await store.loadMetadata({}, 100);
  const page = deferred();
  context.getMetadata.mockReturnValueOnce(page.promise).mockResolvedValueOnce(response('reloaded'));
  const more = store.loadMore(100);
  await store.reload(100);
  page.resolve({ data: { rows: [{ _id: 'late-row', title: 'late page' }] } });
  await more;
  expect(store.data.rows.map(row => row.title)).toEqual(['reloaded']);
  store.destroy();
});

it('reports a pending request failure after destruction without invoking stale callbacks or emitting table events', async () => {
  const notifyError = jest.fn();
  const { store, context } = setup({ onOperationError: notifyError });
  const request = deferred();
  const fail = jest.fn();
  const success = jest.fn();
  const operation = { fail_callback: fail, success_callback: success };
  const completed = request.promise.then(error => store.sendOperationCallback({ operation, error }));
  store.destroy();
  const dispatch = jest.spyOn(context.eventBus, 'dispatch');

  request.resolve('Delete failed');
  await completed;

  expect(notifyError).toHaveBeenCalledWith('Delete failed');
  expect(fail).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
  expect(store.data).toBeNull();
});

it('does not notify or apply a successful response after destruction', () => {
  const notifyError = jest.fn();
  const { store } = setup({ onOperationError: notifyError });
  const success = jest.fn();
  store.destroy();
  store.sendOperationCallback({ operation: { success_callback: success } });
  expect(success).not.toHaveBeenCalled();
  expect(notifyError).not.toHaveBeenCalled();
  expect(store.data).toBeNull();
});

it('keeps active operation failure handling without duplicating background notifications', () => {
  const notifyError = jest.fn();
  const { store } = setup({ onOperationError: notifyError });
  const fail = jest.fn();
  store.data = {};
  store.sendOperationCallback({ operation: { fail_callback: fail }, error: 'Delete failed' });
  expect(fail).toHaveBeenCalledWith('Delete failed');
  expect(notifyError).not.toHaveBeenCalled();
  store.destroy();
});
