import { EventBus } from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from './constants/event-bus-type';

const registry = new Map();
const anonymous = new WeakMap();

export const normalizeMetadataID = (id) => {
  if (id === undefined || id === null) return null;
  if ((typeof id !== 'string' && typeof id !== 'number') || (typeof id === 'number' && !Number.isFinite(id)) || String(id).trim() === '') {
    throw new Error('metadataID must be a non-empty string or finite number');
  }
  return String(id);
};

const getEntry = (id) => {
  if (!registry.has(id)) registry.set(id, { events: new EventBus(), binding: null, subscriptions: 0 });
  return registry.get(id);
};

const release = (id, entry) => {
  if (entry.binding || entry.subscriptions) return;
  entry.events.destroy();
  if (registry.get(id) === entry) registry.delete(id);
};

export const createSeaMetadataController = (metadataID) => {
  const id = normalizeMetadataID(metadataID);
  const state = id === null ? { events: new EventBus(), binding: null } : null;
  const current = () => id === null ? state : registry.get(id);
  const binding = () => current()?.binding;
  const controller = {
    metadataID: id,
    events: {
      dispatch: (type, ...args) => {
        // Commands sent while a table is absent are intentionally discarded.
        const entry = current();
        if (entry?.binding) entry.binding.context.eventBus.dispatch(type, ...args);
      },
      subscribe: (type, handler) => {
        const entry = id === null ? state : getEntry(id);
        if (id !== null) entry.subscriptions += 1;
        const unsubscribe = entry.events.subscribe(type, handler);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          unsubscribe();
          if (id !== null) {
            entry.subscriptions -= 1;
            release(id, entry);
          }
        };
      },
    },
    reload: (...args) => controller.events.dispatch(EVENT_BUS_TYPE.RELOAD_DATA, ...args),
    updateRow: (...args) => controller.events.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, ...args),
    getData: () => binding()?.getData() ?? null,
    getOrderRows: () => binding()?.getOrderRows() ?? [],
    getSelectedRowIds: () => binding()?.getSelectedRowIds() ?? [],
    createMoreOptions: (...args) => binding()?.createMoreOptions(...args) ?? [],
    getSetting: (key, fallback = '') => binding()?.context.getSetting(key, fallback) ?? fallback,
    setSetting: (...args) => binding()?.context.setSetting(...args),
    getPermission: () => binding()?.context.getPermission() ?? 'r',
    canModify: () => binding()?.context.canModify() ?? false,
    canDeleteRow: (...args) => binding()?.context.canDeleteRow(...args) ?? false,
    canDeleteRows: (...args) => binding()?.context.canDeleteRows(...args) ?? false,
  };
  Object.defineProperty(controller, 'storage', { get: () => binding()?.context.localStorage ?? null });
  if (state) anonymous.set(controller, state);
  return controller;
};

export const bindMetadataController = (controller, binding, metadataID = controller.metadataID) => {
  const id = normalizeMetadataID(metadataID);
  if (controller.metadataID !== null && id !== controller.metadataID) throw new Error('Controller metadataID does not match the table');
  const own = controller.metadataID === null ? anonymous.get(controller) : getEntry(controller.metadataID);
  const named = id === null ? null : getEntry(id);
  const entries = [...new Set([own, named].filter(Boolean))];
  if (!own) throw new Error('Invalid SeaMetadata controller');
  if (entries.some(entry => entry.binding)) throw new Error(`SeaMetadata metadataID "${id}" is already mounted`);
  entries.forEach(entry => { entry.binding = binding; });
  const originalBus = binding.context.eventBus;
  let active = true;
  const subscriptions = new Set();
  binding.context.eventBus = {
    dispatch: (type, ...args) => {
      entries.forEach(entry => {
        // A subscriber can synchronously unbind this runtime before its alias
        // receives the event. Never forward the old event to a replacement.
        if (active) entry.events.dispatch(type, ...args);
      });
    },
    // Commands from every handle enter through this facade. Subscribe once so
    // an anonymous page scope and its named alias cannot apply a command twice.
    subscribe: (type, handler) => {
      if (!active) return () => {};
      const unsubscribe = own.events.subscribe(type, (...args) => {
        if (active) handler(...args);
      });
      const dispose = () => {
        if (!subscriptions.delete(dispose)) return;
        unsubscribe();
      };
      subscriptions.add(dispose);
      return dispose;
    },
  };
  return () => {
    if (!active) return;
    active = false;
    subscriptions.forEach(dispose => dispose());
    entries.forEach(entry => { if (entry.binding === binding) entry.binding = null; });
    binding.context.eventBus = originalBus;
    if (named) release(id, named);
  };
};
