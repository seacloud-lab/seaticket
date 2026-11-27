import React, { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import DateEditor from '@/sea-metadata/components/cell-editors/date-editor';
import PriorityEditor from '@/sea-metadata/components/cell-editors/priority-editor';
import SingleSelectEditor from '@/sea-metadata/components/cell-editors/single-select-editor';
import CollaboratorSelector from '@/sea-metadata/components/selectors/collaborator-selector';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';
import EditorPortal from '@/sea-metadata/view/table/editors/editor-portal';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({
  IconButton: () => null,
  PriorityEditor: require('@/components/priority-editor').default,
  CollaboratorEditor: require('@/components/collaborator-editor').default,
  Collaborator: () => null,
  DatePicker: ({ format, calendarProps, calendarContainer }) => {
    const calendar = <div className={calendarProps.className}><input aria-label={format} /></div>;
    return calendarContainer ? require('react-dom').createPortal(calendar, calendarContainer) : calendar;
  },
}));
jest.mock('@/components/icon', () => () => null);
jest.mock('@/components/collaborator/collaborator', () => () => null);
jest.mock('@/components/search-input', () => () => <input aria-label="Option search" autoFocus />);
jest.mock('@/utils/utils', () => ({ Utils: { keyCodes: { esc: 27, enter: 13 } } }));

let root;
let container;
let main;
let dialog;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  main = createMetadataContext(); main.id = 'main'; main.root = container;
  dialog = createMetadataContext(); dialog.id = 'dialog'; dialog.root = container;
});
afterEach(() => {
  act(() => root.unmount());
  main.destroy(); dialog.destroy();
  container.remove();
});

const Table = ({ context, children }) => (
  <SeaMetadataContextProvider context={context}>
    <section data-sea-metadata-instance={context.id}>{children}</section>
  </SeaMetadataContextProvider>
);

it('assigns portalled editors to their table and only selects options in the focused editor', async () => {
  const mainEditor = React.createRef();
  const dialogEditor = React.createRef();
  const column = { key: 'choice', type: 'single-select', data: { options: [{ id: 'a', name: 'First' }] } };
  await act(async () => root.render(
    <>
      <Table context={main}><EditorPortal target={document.body}><SingleSelectEditor ref={mainEditor} column={column} columns={[column]} /></EditorPortal></Table>
      <Table context={dialog}><EditorPortal target={document.body}><SingleSelectEditor ref={dialogEditor} column={column} columns={[column]} /></EditorPortal></Table>
    </>
  ));
  const input = screen.getAllByLabelText('Option search')[1];
  act(() => fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 }));
  expect(mainEditor.current.getValue()).toEqual({ choice: '' });
  expect(dialogEditor.current.getValue()).toEqual({ choice: 'a' });
  expect(dialog.ownsEvent({ target: input })).toBe(true);
});

it('only closes the date editor whose calendar receives Escape', async () => {
  const closeMain = jest.fn();
  const closeDialog = jest.fn();
  await act(async () => root.render(
    <>
      <Table context={main}><DateEditor format="YYYY-MM-DD" onClose={closeMain} /></Table>
      <Table context={dialog}><DateEditor format="DD/MM/YYYY" onClose={closeDialog} /></Table>
    </>
  ));
  act(() => fireEvent.keyDown(screen.getByLabelText('DD/MM/YYYY'), { key: 'Escape', keyCode: 27 }));
  expect(closeMain).not.toHaveBeenCalled();
  expect(closeDialog).toHaveBeenCalledTimes(1);
});

it('does not open or change a selected priority cell from another table keyboard events', async () => {
  const onChange = jest.fn();
  await act(async () => root.render(
    <>
      <Table context={main}><PriorityEditor column={{ key: 'priority' }} isCellSelected value={0} onChange={onChange} /></Table>
      <Table context={dialog}><input aria-label="Other table" /></Table>
    </>
  ));
  const other = screen.getByLabelText('Other table');
  act(() => fireEvent.keyDown(other, { key: 'Enter', keyCode: 13, which: 13 }));
  expect(document.querySelector('.seaqa-priority-editor-popover')).toBeNull();
  await act(async () => container.querySelector('.sea-metadata-priority-editor').click());
  act(() => fireEvent.keyDown(other, { key: '2', keyCode: 50 }));
  expect(onChange).not.toHaveBeenCalled();
  act(() => fireEvent.keyDown(document.activeElement, { key: '2', keyCode: 50 }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('does not select a collaborator or close its selector from another table keyboard events', async () => {
  const onChange = jest.fn();
  await act(async () => root.render(
    <>
      <Table context={main}>
        <CollaboratorSelector column={{ type: 'collaborator' }} collaborators={[{ email: 'a@example.com', name: 'A' }]} value={[]} isCloseSubmit={false} onChange={onChange} />
      </Table>
      <Table context={dialog}><input aria-label="Other table" /></Table>
    </>
  ));
  await act(async () => screen.getByText('Select collaborators').click());
  const other = screen.getByLabelText('Other table');
  act(() => fireEvent.keyDown(other, { key: 'Enter', keyCode: 13, which: 13 }));
  expect(onChange).not.toHaveBeenCalled();
  act(() => fireEvent.keyDown(other, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.options-editor-container')).not.toBeNull();
  act(() => fireEvent.keyDown(document.activeElement, { key: 'Enter', keyCode: 13, which: 13 }));
  expect(onChange).toHaveBeenCalledTimes(1);
});
