# SeaMetadata instances and controllers

[中文文档](./readme.zh.md)

`metadataID` is the main table ID used to locate a mounted table instance within the application. It is not a backend table name or a record ID. When a page and a dialog display the same backend data at the same time, give them different `metadataID` values.

```jsx
import SeaMetadata, { useSeaMetadataController, EVENT_BUS_TYPE } from '@/sea-metadata';

function Page() {
  return <SeaMetadata metadataID="page1-main" api={pageAPI} />;
}

function Dialog() {
  return <SeaMetadata metadataID="page1-dialog" api={dialogAPI} />;
}

// This component can live in another component tree or route.
// There is no need to pass the controller through intermediate components.
function Actions() {
  const main = useSeaMetadataController('page1-main');
  const dialog = useSeaMetadataController('page1-dialog');
  return <>
    <button onClick={() => main.reload()}>Reload main table</button>
    <button onClick={() => dialog.reload()}>Reload dialog table</button>
  </>;
}
```

- Only one table can be bound to an ID at a time. Mounting another table with the same ID throws an error. IDs can be nonempty strings or finite numbers (`0` is valid; numeric `0` and string `'0'` identify the same instance).
- Without `metadataID`, each mount creates an independent anonymous instance. It does not inherit the parent table.
- Components and routes within the same browser application can access an instance by ID. When the target route unmounts, the controller does not keep the table mounted or buffer or replay commands. Controllers do not communicate across browser tabs.
- When the target is not mounted, `getData()` and `storage` return `null`; `getOrderRows()`, `getSelectedRowIds()`, and `createMoreOptions()` return empty arrays. Reload and update commands are ignored.

## Events and data

```jsx
const table = useSeaMetadataController('page1-main');

useEffect(() => {
  return table.events.subscribe(EVENT_BUS_TYPE.SAVED, () => {
    // Receive save events only from this instance.
    // The effect cleanup unsubscribes when the consumer unmounts.
  });
}, [table]);

// Equivalent to table.reload().
table.events.dispatch(EVENT_BUS_TYPE.RELOAD_DATA);
// Update a currently loaded local row. Use the business API to persist changes.
table.updateRow(rowID, { title: 'New title' });
const selected = table.getSelectedRowIds();
```

Each instance owns its Context, Store, event bus, selection state, and table DOM references. Search, clipboard operations, keyboard shortcuts, and column dragging are handled by the owning instance. Business events such as `RESOURCE_UPDATED` still use the application event bus, allowing multiple lists to synchronize the same resource under existing business rules.

Saving ticket, customer issue, or connection record details sends `RESOURCE_UPDATED` to lists with the matching project and table name. This lets the global related issues dialog update the corresponding records even when it is outside the main table Provider, without depending on an inherited controller.

Dragging view tabs, entries in the All views menu, or grouping rules affects only the owning instance. Drags from other instances cannot modify the current table, and view sorting rejects plain text dragged from external applications.

Table editor portals also carry an instance marker. Internal option editors restrict keyboard events through the generic `shouldHandleEvent` callback, and popovers use an instance wrapper through the optional `PopoverComponent` prop. Shared components do not need to import SeaMetadata. When a nested option popover handles Escape, its parent popover stays open. After a controller is unbound, the event bus held by its old runtime becomes inactive and cannot send events to a new instance with the same ID. Controllers obtained by ID can still access the new instance.

When focus is inside a table or one of its popovers, search and Escape are handled by the owning instance. Popovers receive focus when opened and restore it to the trigger when closed, without overriding focus that has already moved to another input. When Escape closes a popover or selector, its matching keyup is also consumed so it cannot close the outer dialog after focus is restored. When focus is on the page `body`, Ctrl/Cmd+F opens table search only if there is exactly one visible main table with `storageNamespace="primary"` and no open dialog.

Switching views destroys the old Store. Responses from old requests cannot update the table or invoke callbacks belonging to the old view. Failures from requests already sent still produce independent `onOperationError` notifications, so errors remain visible after a view switch.

When an entire table unmounts, its controller binding and runtime subscriptions are removed first. Cell editors can then submit pending changes according to their existing behavior before the Context is cleaned up. These submissions use the unmounted instance's original API and cannot be sent to a subsequently mounted table. External controller subscriptions can continue following later instances.

## Storage and URLs

Local settings keys include `localStorageNamePrefix`, `metadataID` or an anonymous instance identifier, `storageNamespace`, and the view ID. Named instances can restore their settings after remounting. Existing pages explicitly use `storageNamespace="primary"` and can read legacy `prefix-viewID` settings; new writes use the isolated keys.

Keep `metadataID` stable when records are edited. Do not construct it from record contents or update timestamps. Customer and user main tables use fixed IDs per project. Data changes trigger reloads through a separate React `key`, preserving sorting and column widths.

New tables do not read or modify the URL's `view` parameter by default. Enable URL synchronization explicitly when needed:

```jsx
<SeaMetadata metadataID="page1-main" api={pageAPI} isShowViewInURL />
<SeaMetadata metadataID="page1-dialog" api={dialogAPI}
  isShowViewInURL viewURLParam="dialogView" />
```

Tables that synchronize URLs at the same time should use different `viewURLParam` values. Existing main pages explicitly retain their previous URL behavior.

## Migration and compatibility

The global `context` export has been removed. Use the controller's `events` for table events. The existing ref methods `getData()`, `getOrderRows()`, and `createMoreOptions()` remain available, with `getSelectedRowIds()` added. Resource menus in this PR remain bound to the Store that created them; an old menu cannot operate on a new Store after a view switch or unmount.

`@/sea-metadata/controller-provider` is a lightweight controller entry point that does not load table views. Hosts calling `withSeaMetadataController` at module scope import it from this entry point to avoid accessing an uninitialized public entry point when table views load the host again through resource details.

Existing workflows shared by a parent component, a sibling toolbar, and a child table use `SeaMetadataControllerProvider` / `useMetadataController()` to share a scope. Standalone `Tickets`, `Issues`, and customer dialog hosts each create their own scope; pass an existing `controller` to reuse one explicitly. When both an anonymous scope controller and `metadataID` are supplied, both entry points refer to the same table, and calls by ID remain available. A named controller's ID must match the table's `metadataID`.

The project knowledge base main table uses `project-knowledge-main-${projectUuid}` as its ID. The sidebar import dialog, which is outside the main content Provider, obtains the controller by this ID and reloads only the corresponding project's main table after import.

Use `SeaMetadataScope` when reusing internal controls such as the selection Provider or cards independently. It does not mount or register an entire table.

This change preserves the existing dependencies between pages, business hooks, and SeaMetadata while migrating instance access. The existing deep imports should be consolidated in a later cleanup of module public APIs.
