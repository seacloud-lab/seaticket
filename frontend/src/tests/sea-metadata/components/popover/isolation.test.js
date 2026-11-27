import React, { act } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import CustomizePopover from '@/components/customize-popover';
import ContextMenu from '@/sea-metadata/components/context-menu';
import RowHeightPopover from '@/sea-metadata/components/popover/row-height-popover';
import ScopedPopover from '@/sea-metadata/components/popover/scoped-popover';
import ViewItem from '@/sea-metadata/components/view-toolbar/views/view-item';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';
import InsertColumn from '@/sea-metadata/view/table/table-main/rows-header/insert-column';

jest.mock('reactstrap', () => {
  const React = require('react');
  const { createPortal } = require('react-dom');
  const Div = ({ children, className, ...props }) => <div className={className} data-sea-metadata-instance={props['data-sea-metadata-instance']}>{children}</div>;
  return {
    Popover: ({ children, className }) => createPortal(<div className={className}>{children}</div>, global.document.body),
    Dropdown: Div, DropdownMenu: Div, FormGroup: Div, FormFeedback: Div,
    Label: ({ children }) => <label>{children}</label>,
    DropdownToggle: ({ children }) => <span>{children}</span>,
    DropdownItem: ({ children, onClick, divider }) => divider ? null : <button onClick={onClick}>{children}</button>,
    Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    Input: React.forwardRef((props, ref) => <input {...props} ref={ref} />),
  };
});
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({
  Icon: () => null,
  ClickOutside: ({ children }) => children,
  ModalPortal: ({ children }) => require('react-dom').createPortal(children, global.document.body),
}));
jest.mock('@/components/icon', () => () => null);
jest.mock('@/components/modal-portal', () => ({ children }) => require('react-dom').createPortal(children, global.document.body));
jest.mock('@/utils/utils', () => ({ Utils: { keyCodes: { esc: 27, enter: 13 } } }));
jest.mock('@/sea-metadata/hooks', () => ({ useMetadata: () => ({ metadata: { columns: [] } }) }));
jest.mock('@/sea-metadata/components/popover/column-popover/data', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ getValue: () => ({}), setValue: () => {} }));
    return null;
  });
});

let root;
let container;
let context;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  context = createMetadataContext();
  context.id = 'main';
  context.root = container;
});
afterEach(() => {
  act(() => root.unmount());
  context.destroy();
  container.remove();
});

it('isolates portalled popover mouse and keyboard events while allowing outside clicks', () => {
  const hide = jest.fn();
  const escape = jest.fn();
  act(() => root.render(
    <SeaMetadataContextProvider context={context}>
      <ScopedPopover target="main" hidePopover={hide} hidePopoverWithEsc={escape}>
        <input aria-label="Own popover" />
      </ScopedPopover>
      <section data-sea-metadata-instance="dialog"><input aria-label="Other table" /></section>
      <button>Outside</button>
    </SeaMetadataContextProvider>
  ));
  const own = screen.getByLabelText('Own popover');
  expect(container.contains(own)).toBe(false);
  act(() => {
    fireEvent.mouseDown(own);
    fireEvent.mouseDown(screen.getByLabelText('Other table'));
    fireEvent.keyDown(screen.getByLabelText('Other table'), { keyCode: 27 });
  });
  expect(hide).not.toHaveBeenCalled();
  expect(escape).not.toHaveBeenCalled();

  act(() => fireEvent.keyDown(own, { keyCode: 27 }));
  expect(escape).toHaveBeenCalledTimes(1);
  act(() => fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' })));
  expect(hide).toHaveBeenCalledTimes(1);
});

it('keeps shared popovers responsive without a SeaMetadata event filter', () => {
  const hide = jest.fn();
  act(() => root.render(
    <>
      <CustomizePopover target="main" hidePopover={hide} hidePopoverWithEsc={hide}><input /></CustomizePopover>
      <section data-sea-metadata-instance="dialog"><button>Other table</button></section>
    </>
  ));
  act(() => fireEvent.keyDown(screen.getByRole('button'), { keyCode: 27 }));
  expect(hide).toHaveBeenCalledTimes(1);
  act(() => fireEvent.mouseDown(screen.getByRole('button')));
  expect(hide).toHaveBeenCalledTimes(2);
});

it.each(['row', 'view'])('keeps another table popover open when interacting with a portalled %s menu', (type) => {
  const hide = jest.fn();
  const dialog = createMetadataContext();
  dialog.id = 'dialog';
  dialog.root = container;
  act(() => root.render(
    <SeaMetadataContextProvider context={context}>
      <ScopedPopover target="main" hidePopover={hide}><input aria-label="Main popover" /></ScopedPopover>
      <section data-sea-metadata-instance={dialog.id}>
        {type === 'row' ? (
          <>
            <button id="dialog-row">Dialog row</button>
            <ContextMenu
              context={dialog}
              target={() => document.getElementById('dialog-row')}
              createContextMenuOptions={() => [{ key: 'edit', label: 'Edit dialog row', callback: () => {} }]}
            />
          </>
        ) : (
          <SeaMetadataContextProvider context={dialog}>
            <ViewItem view={{ _id: 'view', name: 'Dialog view' }} isSelect modifyAble onSelect={() => {}} />
          </SeaMetadataContextProvider>
        )}
      </section>
    </SeaMetadataContextProvider>
  ));
  act(() => {
    if (type === 'row') fireEvent.contextMenu(screen.getByRole('button', { name: 'Dialog row' }));
    else container.querySelector('.sea-metadata-view-item-operation-down').click();
  });
  const menuItem = screen.getByRole('button', { name: type === 'row' ? 'Edit dialog row' : 'Rename view' });
  expect(container.contains(menuItem)).toBe(false);
  act(() => fireEvent.mouseDown(menuItem));
  expect(hide).not.toHaveBeenCalled();
  expect(dialog.ownsEvent({ target: menuItem })).toBe(true);
  expect(context.ownsEvent({ target: menuItem })).toBe(false);
  dialog.destroy();
});

it('keeps focus after clicking a row-height heading and restores the trigger on Escape', () => {
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <SeaMetadataContextProvider context={context}>
        <section data-sea-metadata-instance={context.id}>
          <button id="row-height-trigger" onClick={() => setOpen(true)}>Row height</button>
        </section>
        {open && <RowHeightPopover target="row-height-trigger" hidePopover={() => setOpen(false)} onChange={() => {}} />}
      </SeaMetadataContextProvider>
    );
  };
  act(() => root.render(<Example />));
  const trigger = screen.getByRole('button', { name: 'Row height' });
  act(() => { trigger.focus(); trigger.click(); });
  const heading = screen.getByText('Select row height');
  const popover = heading.closest('[data-sea-metadata-instance]');
  expect(popover.contains(document.activeElement)).toBe(true);

  act(() => {
    fireEvent.mouseDown(heading);
    // Model Chromium's default blur when a non-focusable heading is clicked.
    document.activeElement.blur();
    fireEvent.click(heading);
  });
  expect(popover.contains(document.activeElement)).toBe(true);
  act(() => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27 }));
  expect(screen.queryByText('Select row height')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('preserves autofocus inside a popover and does not restore focus over another table', () => {
  const render = open => (
    <SeaMetadataContextProvider context={context}>
      <button id="focus-trigger">Trigger</button>
      {open && (
        <ScopedPopover target="focus-trigger" hidePopover={() => {}}>
          <input aria-label="Autofocused input" autoFocus />
        </ScopedPopover>
      )}
      <section data-sea-metadata-instance="other"><input aria-label="Other input" /></section>
    </SeaMetadataContextProvider>
  );
  act(() => root.render(render(true)));
  expect(document.activeElement).toBe(screen.getByLabelText('Autofocused input'));
  const other = screen.getByLabelText('Other input');
  act(() => other.focus());
  act(() => root.render(render(false)));
  expect(document.activeElement).toBe(other);
});

it('keeps the insert-column form open across its body portals and other instances', () => {
  const insert = jest.fn();
  act(() => root.render(
    <SeaMetadataContextProvider context={context}>
      <section data-sea-metadata-instance={context.id}>
        <InsertColumn lastColumn={{ left: 0, width: 100 }} insertColumn={insert} />
      </section>
      <section data-sea-metadata-instance="dialog"><button>Other table</button></section>
      <button>Outside</button>
    </SeaMetadataContextProvider>
  ));
  const open = () => act(() => within(container).getByRole('button', { name: 'Text' }).click());
  open();
  const name = screen.getByPlaceholderText('{Column} name');
  expect(container.contains(name)).toBe(false);
  act(() => {
    fireEvent.mouseDown(name);
    fireEvent.change(name, { target: { value: 'New column' } });
  });
  const dropdown = document.body.querySelector('.sea-metadata-column-popover-inner .sea-metadata-column-type-dropdown-menu');
  // ColumnType renders its dropdown through a second body portal.
  expect(dropdown).toBeNull();
  const menuInput = Array.from(document.querySelectorAll('.sea-metadata-column-type-dropdown-menu input')).find(input => !container.contains(input));
  expect(menuInput.closest('[data-sea-metadata-instance]').getAttribute('data-sea-metadata-instance')).toBe(context.id);
  act(() => {
    fireEvent.mouseDown(menuInput);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Other table' }));
  });
  expect(screen.getByPlaceholderText('{Column} name')).toBe(name);
  act(() => {
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Submit' }));
    screen.getByRole('button', { name: 'Submit' }).click();
  });
  expect(insert).toHaveBeenCalledWith('New column', 'text', { key: '', data: null });
  expect(screen.queryByPlaceholderText('{Column} name')).toBeNull();

  open();
  act(() => fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' })));
  expect(screen.queryByPlaceholderText('{Column} name')).toBeNull();
});
