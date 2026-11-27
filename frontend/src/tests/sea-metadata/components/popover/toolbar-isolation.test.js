import React, { act } from 'react';
import { Modal } from 'reactstrap';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import FilterPopover from '@/sea-metadata/components/popover/filter-popover';
import GroupbysPopover from '@/sea-metadata/components/popover/groupbys-popover';
import HiddenColumnPopover from '@/sea-metadata/components/popover/hidden-column-popover';
import RenamePopover from '@/sea-metadata/components/popover/rename-popover';
import RowHeightPopover from '@/sea-metadata/components/popover/row-height-popover';
import ScopedPopover from '@/sea-metadata/components/popover/scoped-popover';
import SortPopover from '@/sea-metadata/components/popover/sort-popover';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';
import HeaderDropdownMenu from '@/sea-metadata/view/table/table-main/rows-header/cell/dropdown-menu';

jest.mock('@/constants', () => ({ gettext: text => text, KeyCodes: { Enter: 13 } }));
jest.mock('@/components', () => {
  const React = require('react');
  return {
    IconButton: () => null,
    Icon: () => null,
    ModalPortal: ({ children }) => require('react-dom').createPortal(children, global.document.body),
    CustomizeDropdownMenu: React.forwardRef(({ children, className }, ref) => <div ref={ref} className={className}>{children}</div>),
    CustomizeDropdownItem: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    CustomizeDropdownItemText: ({ children }) => <span>{children}</span>,
  };
});
jest.mock('@/components/toaster', () => ({ danger: jest.fn() }));
jest.mock('@/components/btn/customize-button', () => ({ callBack, name }) => <button onClick={callBack}>{name}</button>);
jest.mock('@/components/icon', () => () => null);
jest.mock('@/components/modal-portal', () => ({ children }) => require('react-dom').createPortal(children, global.document.body));
jest.mock('@/components/search-input', () => () => <input aria-label="Column search" autoFocus />);
jest.mock('@/sea-metadata/hooks', () => ({
  useMetadata: () => ({ metadata: { columns: [] } }),
  useTypesData: () => ({ toggleAllTypes: () => {} }),
  useSubstatesData: () => ({}),
}));
jest.mock('@/sea-metadata/components/selectors', () => ({ ColumnSelector: () => null, SortSelector: () => null }));
jest.mock('@/sea-metadata/components/popover/filter-popover/advanced-filters', () => () => <div>Filter heading</div>);
jest.mock('@/sea-metadata/components/popover/filter-popover/basic-filters', () => () => null);
jest.mock('@/sea-metadata/components/popover/groupbys-popover/groupbys', () => () => {
  const React = require('react');
  const OptionsEditor = require('@/components/options-editor').default;
  const ScopedPopover = require('@/sea-metadata/components/popover/scoped-popover').default;
  const ScopedSelect = require('@/sea-metadata/components/selectors/scoped-select').default;
  const context = require('@/sea-metadata/context-provider').useSeaMetadataContext();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div>Group heading</div>
      <div id="nested-options" onClick={() => setOpen(true)}>Nested options</div>
      <ScopedSelect placeholder="Nested column" isInModal options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />
      {open && <OptionsEditor target="nested-options" options={[]} PopoverComponent={ScopedPopover} shouldHandleEvent={context.ownsEvent} onToggle={() => setOpen(false)} />}
    </>
  );
});
jest.mock('@/sea-metadata/components/popover/hidden-column-popover/hidden-columns', () => () => <div>Columns heading</div>);
jest.mock('@/utils/utils', () => ({ Utils: { keyCodes: { esc: 27, enter: 13 } } }));

const popovers = [
  ['filter', FilterPopover, { filters: [], basicFilters: [], update: jest.fn() }, 'Filter heading'],
  ['sort', SortPopover, { sorts: [], update: jest.fn() }, 'No sorts'],
  ['group', GroupbysPopover, { groupbys: [], onChange: jest.fn() }, 'Group heading'],
  ['columns', HiddenColumnPopover, { hiddenColumns: [], onChange: jest.fn() }, 'Columns heading'],
];

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

const openPopover = async (Popover, props, children) => {
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <SeaMetadataContextProvider context={context}>
        <section data-sea-metadata-instance={context.id}>
          <button id="trigger" onClick={() => setOpen(true)}>Trigger</button>
        </section>
        {open && <Popover {...props} target="trigger" columns={[]} placement="bottom-end" hidePopover={() => { props.hidePopover?.(); setOpen(false); }} />}
        {children}
      </SeaMetadataContextProvider>
    );
  };
  await act(async () => root.render(<Example />));
  const trigger = screen.getByText('Trigger');
  await act(async () => { trigger.focus(); trigger.click(); });
  return trigger;
};

it.each(popovers)('does not close the %s popover or intercept another table click', async (name, Popover, props) => {
  const hide = jest.fn();
  const otherClick = jest.fn();
  await openPopover(Popover, { ...props, hidePopover: hide },
    <>
      <section data-sea-metadata-instance="dialog"><button onClick={otherClick}>Other table</button></section>
      <button>Outside</button>
    </>
  );
  await act(async () => screen.getByText('Other table').click());
  expect(hide).not.toHaveBeenCalled();
  expect(otherClick).toHaveBeenCalledTimes(1);
  await act(async () => screen.getByText('Outside').click());
  expect(hide).toHaveBeenCalledTimes(1);
});

it.each(popovers)('keeps %s popover keyboard ownership after clicking non-focusable content', async (name, Popover, props, heading) => {
  const trigger = await openPopover(Popover, props);
  const content = screen.getByText(heading);
  await act(async () => {
    fireEvent.mouseDown(content);
    document.activeElement.blur();
    fireEvent.click(content);
  });
  expect(content.closest('[data-sea-metadata-instance]').contains(document.activeElement)).toBe(true);
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(screen.queryByText(heading)).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it.each(popovers)('allows closing the %s popover while another table has a selector open', async (name, Popover, props) => {
  const hide = jest.fn();
  await openPopover(Popover, { ...props, hidePopover: hide },
    <>
      <section data-sea-metadata-instance="dialog">
        <div className="seaqa-select-options-container">Other column selector</div>
        <div className="sea-metadata-data-filter-popover">Other filter selector</div>
      </section>
      <button>Outside</button>
    </>
  );
  await act(async () => screen.getByText('Outside').click());
  expect(hide).toHaveBeenCalledTimes(1);
});

it('only submits a column rename for Enter from its own table', async () => {
  const submit = jest.fn();
  await openPopover(RenamePopover, { value: 'Old', onToggle: () => {}, onSubmit: submit },
    <section data-sea-metadata-instance="dialog"><input aria-label="Other table" /></section>
  );
  const name = screen.getByDisplayValue('Old');
  act(() => fireEvent.change(name, { target: { value: 'New' } }));
  act(() => fireEvent.keyDown(screen.getByLabelText('Other table'), { keyCode: 13 }));
  expect(submit).not.toHaveBeenCalled();
  act(() => fireEvent.keyDown(name, { keyCode: 13 }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledWith('New');
});

it('closes a nested options popover on Escape without closing its parent', async () => {
  await openPopover(GroupbysPopover, { groupbys: [], onChange: () => {} });
  await act(async () => screen.getByText('Nested options').click());
  expect(document.querySelector('.options-editor-container')).not.toBeNull();
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.options-editor-container')).toBeNull();
  expect(screen.queryByText('Group heading')).not.toBeNull();
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(screen.queryByText('Group heading')).toBeNull();
});

it('scopes a portalled column menu and closes only that menu on the first Escape', async () => {
  await openPopover(GroupbysPopover, { groupbys: [], onChange: () => {} });
  await act(async () => screen.getByText('Nested column').click());
  const menu = document.querySelector('.seaqa-select-options-container');
  expect(context.ownsEvent({ target: menu })).toBe(true);
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.seaqa-select-options-container')).toBeNull();
  expect(screen.queryByText('Group heading')).not.toBeNull();
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(screen.queryByText('Group heading')).toBeNull();
});

it('keeps the parent open when choosing from its own portalled column menu', async () => {
  await openPopover(GroupbysPopover, { groupbys: [], onChange: () => {} });
  await act(async () => screen.getByText('Nested column').click());
  await act(async () => screen.getByText('A').click());
  expect(document.querySelector('.seaqa-select-options-container')).toBeNull();
  expect(screen.queryByText('Group heading')).not.toBeNull();
});

it('keeps another table popover open when using a portalled column-header menu', async () => {
  const hide = jest.fn();
  const dialog = createMetadataContext();
  dialog.id = 'dialog';
  dialog.root = container;
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <SeaMetadataContextProvider context={context}>
          <button id="main-menu-trigger" onClick={() => setOpen(true)}>Main trigger</button>
          {open && <ScopedPopover target="main-menu-trigger" hidePopover={hide}><span>Main popover</span></ScopedPopover>}
        </SeaMetadataContextProvider>
        <SeaMetadataContextProvider context={dialog}>
          <section data-sea-metadata-instance={dialog.id}>
            <HeaderDropdownMenu column={{ key: 'type', type: 'type' }} view={{}} />
          </section>
        </SeaMetadataContextProvider>
      </>
    );
  };
  await act(async () => root.render(<Example />));
  await act(async () => screen.getByRole('button', { name: 'Main trigger' }).click());
  await act(async () => screen.getByRole('button', { name: 'More operations' }).click());
  const menuItem = screen.getByRole('button', { name: 'Manage types' });
  expect(container.contains(menuItem)).toBe(false);
  await act(async () => fireEvent.mouseDown(menuItem));
  expect(hide).not.toHaveBeenCalled();
  expect(dialog.ownsEvent({ target: menuItem })).toBe(true);
  expect(context.ownsEvent({ target: menuItem })).toBe(false);
  dialog.destroy();
});

const openModalPopover = async (Popover, props) => {
  const toggle = jest.fn();
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <Modal isOpen fade={false} toggle={toggle}>
        <SeaMetadataContextProvider context={context}>
          <section data-sea-metadata-instance={context.id}>
            <button id="modal-trigger" onClick={() => setOpen(true)}>Modal trigger</button>
            {open && <Popover {...props} target="modal-trigger" columns={[]} hidePopover={() => setOpen(false)} />}
          </section>
        </SeaMetadataContextProvider>
      </Modal>
    );
  };
  await act(async () => root.render(<Example />));
  const trigger = screen.getByText('Modal trigger');
  await act(async () => { trigger.focus(); trigger.click(); });
  return { trigger, toggle };
};

it.each([
  ...popovers,
  ['row height', RowHeightPopover, { onChange: () => {} }, 'Select row height'],
])('consumes the full Escape keystroke when closing the %s popover inside a modal', async (name, Popover, props, heading) => {
  const { trigger, toggle } = await openModalPopover(Popover, props);
  await act(async () => {
    const content = screen.getByText(heading);
    fireEvent.mouseDown(content);
    document.activeElement.blur();
    fireEvent.click(content);
  });
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(screen.queryByText(heading)).toBeNull();
  expect(document.activeElement).toBe(trigger);
  // Holding Escape after focus restoration must not lose the consumed keydown.
  await act(async () => fireEvent.keyDown(trigger, { key: 'Escape', keyCode: 27, which: 27, repeat: true }));
  await act(async () => fireEvent.keyUp(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(toggle).not.toHaveBeenCalled();

  // A new Escape keystroke still closes the modal normally.
  await act(async () => fireEvent.keyDown(trigger, { key: 'Escape', keyCode: 27, which: 27 }));
  await act(async () => fireEvent.keyUp(trigger, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(toggle).toHaveBeenCalledTimes(1);
});

it('closes a nested selector, its parent popover, and the modal with separate Escape keystrokes', async () => {
  const { toggle } = await openModalPopover(GroupbysPopover, { groupbys: [], onChange: () => {} });
  await act(async () => screen.getByText('Nested column').click());
  expect(document.querySelector('.seaqa-select-options-container')).not.toBeNull();
  const pressEscape = async () => {
    await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
    await act(async () => fireEvent.keyUp(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  };
  await pressEscape();
  expect(document.querySelector('.seaqa-select-options-container')).toBeNull();
  expect(screen.queryByText('Group heading')).not.toBeNull();
  expect(toggle).not.toHaveBeenCalled();
  await pressEscape();
  expect(screen.queryByText('Group heading')).toBeNull();
  expect(toggle).not.toHaveBeenCalled();
  await pressEscape();
  expect(toggle).toHaveBeenCalledTimes(1);
});
