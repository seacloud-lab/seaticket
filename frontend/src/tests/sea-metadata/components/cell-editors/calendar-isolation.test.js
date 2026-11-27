import React, { act } from 'react';
import { Modal } from 'reactstrap';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import DateEditor from '@/sea-metadata/components/cell-editors/date-editor';
import ScopedPopover from '@/sea-metadata/components/popover/scoped-popover';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';
import EditorPortal from '@/sea-metadata/view/table/editors/editor-portal';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({ DatePicker: require('@/components/calendar-picker/date-picker').default }));
jest.mock('@/components/icon-tooltip', () => () => null);
jest.mock('@/utils/utils', () => ({ Utils: { keyCodes: { esc: 27, enter: 13 } } }));

let root;
let container;
let main;
let dialog;
let previousApp;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});
beforeEach(() => {
  previousApp = window.app;
  window.app = { config: { lang: 'en' } };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  main = createMetadataContext(); main.id = 'calendar-main'; main.root = container;
  dialog = createMetadataContext(); dialog.id = 'calendar-dialog'; dialog.root = container;
});
afterEach(() => {
  act(() => root.unmount());
  main.destroy(); dialog.destroy(); container.remove();
  window.app = previousApp;
});

it('keeps a dialog calendar in its own event scope without closing a main table popover', async () => {
  const hide = jest.fn();
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <SeaMetadataContextProvider context={main}>
          <section data-sea-metadata-instance={main.id}>
            <button id="calendar-main-trigger" onClick={() => setOpen(true)}>Main trigger</button>
            {open && <ScopedPopover target="calendar-main-trigger" hidePopover={hide}><input aria-label="Main popover" /></ScopedPopover>}
          </section>
        </SeaMetadataContextProvider>
        <SeaMetadataContextProvider context={dialog}>
          <section data-sea-metadata-instance={dialog.id}>
            <EditorPortal target={document.body}>
              <div className="positioned-date-editor" style={{ position: 'absolute', zIndex: 9 }}><DateEditor format="YYYY-MM-DD" /></div>
            </EditorPortal>
          </section>
        </SeaMetadataContextProvider>
      </>
    );
  };
  await act(async () => root.render(<Example />));
  await act(async () => screen.getByText('Main trigger').click());
  const calendar = document.querySelector('.rc-calendar');
  expect(calendar).not.toBeNull();
  expect(container.contains(calendar)).toBe(false);
  expect(document.querySelector('.positioned-date-editor').contains(calendar)).toBe(false);
  await act(async () => fireEvent.mouseDown(calendar.querySelector('input')));
  expect(hide).not.toHaveBeenCalled();
  expect(dialog.ownsEvent({ target: calendar })).toBe(true);
  expect(main.ownsEvent({ target: calendar })).toBe(false);
  expect(screen.getByLabelText('Main popover')).not.toBeNull();
});

it('closes the calendar without closing the containing modal on the same Escape keystroke', async () => {
  const toggle = jest.fn();
  const Example = () => {
    const [editing, setEditing] = React.useState(true);
    const cell = React.useRef(null);
    return (
      <Modal isOpen fade={false} toggle={toggle}>
        <SeaMetadataContextProvider context={dialog}>
          <section data-sea-metadata-instance={dialog.id}>
            <button ref={cell}>Selected cell</button>
            {editing && (
              <EditorPortal target={document.body}>
                <DateEditor format="YYYY-MM-DD" onClose={() => { setEditing(false); cell.current.focus(); }} />
              </EditorPortal>
            )}
          </section>
        </SeaMetadataContextProvider>
      </Modal>
    );
  };
  await act(async () => root.render(<Example />));
  const input = document.querySelector('.rc-calendar-input');
  act(() => input.focus());
  await act(async () => fireEvent.keyDown(input, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.rc-calendar')).toBeNull();
  expect(document.activeElement).toBe(screen.getByText('Selected cell'));
  await act(async () => fireEvent.keyUp(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(toggle).not.toHaveBeenCalled();

  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  await act(async () => fireEvent.keyUp(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(toggle).toHaveBeenCalledTimes(1);
});
