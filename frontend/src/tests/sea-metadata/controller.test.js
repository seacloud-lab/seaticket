import { createMetadataContext } from '@/sea-metadata/context';
import { bindMetadataController, createSeaMetadataController } from '@/sea-metadata/controller';

jest.mock('@/constants', () => ({ gettext: text => text }));

const mount = (controller, metadataID = controller.metadataID) => {
  const context = createMetadataContext();
  const binding = { context, getData: () => ({ rows: [metadataID] }), getSelectedRowIds: () => ['row'], getOrderRows: () => ['row'], createMoreOptions: () => [] };
  const unbind = bindMetadataController(controller, binding, metadataID);
  return { context, unmount: () => { unbind(); context.destroy(); } };
};

it('addresses one live table by metadataID and discards commands while absent', () => {
  const first = createSeaMetadataController('controller-main');
  const elsewhere = createSeaMetadataController('controller-main');
  const dialog = createSeaMetadataController('controller-dialog');
  const onMain = jest.fn();
  const stop = elsewhere.events.subscribe('reload', onMain);
  elsewhere.events.dispatch('reload');
  expect(onMain).not.toHaveBeenCalled();
  const mainMount = mount(first);
  const dialogMount = mount(dialog);
  const onDialog = jest.fn();
  const stopDialog = dialogMount.context.eventBus.subscribe('reload', onDialog);
  elsewhere.events.dispatch('reload');
  expect(onMain).toHaveBeenCalledTimes(1);
  expect(onDialog).not.toHaveBeenCalled();
  expect(elsewhere.getData()).toEqual({ rows: ['controller-main'] });
  mainMount.unmount();
  expect(elsewhere.getData()).toBeNull();
  expect(elsewhere.getSelectedRowIds()).toEqual([]);
  elsewhere.events.dispatch('reload');
  expect(onMain).toHaveBeenCalledTimes(1);
  const next = mount(first);
  elsewhere.events.dispatch('reload');
  expect(onMain).toHaveBeenCalledTimes(2);
  stop(); stop(); stopDialog(); next.unmount(); dialogMount.unmount();
});

it('releases a named entry after unmount and the last unsubscribe', () => {
  const controller = createSeaMetadataController('controller-release');
  const stop = controller.events.subscribe('change', jest.fn());
  const instance = mount(controller);
  const spy = jest.spyOn(instance.context.eventBus, 'dispatch');
  instance.unmount();
  stop();
  const next = mount(controller);
  controller.events.dispatch('change');
  expect(spy).not.toHaveBeenCalled();
  expect(controller.getData()).toEqual({ rows: ['controller-release'] });
  next.unmount();
});

it('rejects duplicate bindings without disrupting the original table', () => {
  const controller = createSeaMetadataController('controller-duplicate');
  const live = mount(controller);
  expect(() => mount(createSeaMetadataController('controller-duplicate'))).toThrow('already mounted');
  expect(controller.getData()).toEqual({ rows: ['controller-duplicate'] });
  live.unmount();
});

it('does not send events from an unmounted runtime to a replacement with the same ID', () => {
  const controller = createSeaMetadataController('controller-replaced-runtime');
  const stop = controller.events.subscribe('change', jest.fn());
  const first = mount(controller);
  const oldBus = first.context.eventBus;
  first.unmount();
  const next = mount(controller);
  const changed = jest.fn();
  const stopNext = next.context.eventBus.subscribe('change', changed);
  oldBus.dispatch('change');
  expect(changed).not.toHaveBeenCalled();
  controller.events.dispatch('change');
  expect(changed).toHaveBeenCalledTimes(1);
  stopNext(); next.unmount(); stop();
});

it('keeps anonymous instances isolated and exposes an existing scoped table by its metadataID', () => {
  const scoped = createSeaMetadataController();
  const other = createSeaMetadataController();
  const live = mount(scoped, 'controller-alias');
  const otherLive = mount(other);
  const changed = jest.fn();
  const stop = live.context.eventBus.subscribe('change', changed);
  other.events.dispatch('change');
  expect(changed).not.toHaveBeenCalled();
  const named = createSeaMetadataController('controller-alias');
  named.events.dispatch('change');
  scoped.events.dispatch('change');
  expect(changed).toHaveBeenCalledTimes(2);
  live.context.eventBus.dispatch('change');
  expect(changed).toHaveBeenCalledTimes(3);
  stop(); live.unmount(); otherLive.unmount();
});

it.each([undefined, 'controller-runtime-cleanup'])('cleans runtime subscriptions when reusing controller %s without removing external subscriptions', metadataID => {
  const controller = createSeaMetadataController(metadataID);
  const external = jest.fn();
  const stopExternal = controller.events.subscribe('change', external);
  const first = mount(controller);
  const oldRuntime = jest.fn();
  const stopOldRuntime = first.context.eventBus.subscribe('change', oldRuntime);
  first.unmount();

  const next = mount(controller);
  const newRuntime = jest.fn();
  const stopNewRuntime = next.context.eventBus.subscribe('change', newRuntime);
  controller.events.dispatch('change');
  expect(oldRuntime).not.toHaveBeenCalled();
  expect(newRuntime).toHaveBeenCalledTimes(1);
  expect(external).toHaveBeenCalledTimes(1);

  // Late effect cleanups must be safe after the binding already disposed them.
  stopOldRuntime(); stopOldRuntime(); stopNewRuntime();
  next.unmount(); stopExternal();
});

it('ignores old runtime handlers still in an event dispatch snapshot after unbinding', () => {
  const controller = createSeaMetadataController();
  let live;
  const stopExternal = controller.events.subscribe('change', () => live.unmount());
  live = mount(controller);
  const handler = jest.fn();
  live.context.eventBus.subscribe('change', handler);

  controller.events.dispatch('change');

  expect(handler).not.toHaveBeenCalled();
  stopExternal();
});

it('stops forwarding an event to its named alias when a subscriber replaces the table during dispatch', () => {
  const scoped = createSeaMetadataController();
  const named = createSeaMetadataController('controller-dispatch-replacement');
  const stopNamed = named.events.subscribe('change', jest.fn());
  const first = mount(scoped, named.metadataID);
  const replacementHandler = jest.fn();
  let replacement;
  const stopScoped = scoped.events.subscribe('change', () => {
    first.unmount();
    replacement = mount(named);
    replacement.context.eventBus.subscribe('change', replacementHandler);
  });

  try {
    scoped.events.dispatch('change');
    expect(replacementHandler).not.toHaveBeenCalled();
    named.events.dispatch('change');
    expect(replacementHandler).toHaveBeenCalledTimes(1);
  } finally {
    stopScoped(); replacement?.unmount(); stopNamed();
  }
});

it('keeps external subscriptions when a runtime callback has the same handler and is cleaned twice', () => {
  const controller = createSeaMetadataController();
  const live = mount(controller);
  const handler = jest.fn();
  const stopRuntime = live.context.eventBus.subscribe('change', handler);
  const stopExternal = controller.events.subscribe('change', handler);
  stopRuntime(); stopRuntime();

  controller.events.dispatch('change');

  expect(handler).toHaveBeenCalledTimes(1);
  live.unmount(); stopExternal();
});

it('normalizes numeric IDs and rejects ambiguous IDs', () => {
  expect(createSeaMetadataController(0).metadataID).toBe('0');
  for (const id of ['', ' ', {}, true, Infinity, NaN]) {
    expect(() => createSeaMetadataController(id)).toThrow('metadataID');
  }
});

it('assigns nested DOM and portalled widgets only to their own instance', () => {
  const main = createMetadataContext(); const dialog = createMetadataContext();
  const root = document.createElement('div'); const nested = document.createElement('div');
  const input = document.createElement('input'); const portal = document.createElement('div');
  main.id = 'owner-main'; dialog.id = 'owner-dialog';
  root.setAttribute('data-sea-metadata-instance', main.id);
  nested.setAttribute('data-sea-metadata-instance', dialog.id);
  portal.setAttribute('data-sea-metadata-instance', dialog.id);
  root.appendChild(nested); nested.appendChild(input);
  main.root = root; dialog.root = nested;
  expect(main.ownsEvent({ target: input })).toBe(false);
  expect(dialog.ownsEvent({ target: input })).toBe(true);
  expect(main.ownsEvent({ target: portal })).toBe(false);
  expect(dialog.ownsEvent({ target: portal })).toBe(true);
  main.destroy(); dialog.destroy();
});
