import React, { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import RowColorPopover from '@/sea-metadata/components/popover/row-color-popover';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';

jest.mock('@/constants', () => ({
  gettext: text => text,
  SELECT_OPTION_COLORS: [
    { COLOR: '#ffffff', BORDER_COLOR: '#dddddd', TEXT_COLOR: '#000000' },
    { COLOR: '#000000', BORDER_COLOR: '#dddddd', TEXT_COLOR: '#ffffff' },
  ],
}));
jest.mock('@/components', () => ({
  ColorSelectorPopover: require('@/components/color-selector-popover').default,
  IconButton: require('@/components/icon-button').default,
}));
jest.mock('@/components/icon-button', () => ({ __esModule: true, default: ({ icon, size, ...props }) => <button {...props} /> }));
jest.mock('@/components/btn/customize-button', () => ({ callBack, name }) => <button onClick={callBack}>{name}</button>);
jest.mock('@/components/toaster', () => ({ danger: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { keyCodes: { esc: 27, enter: 13 } } }));
jest.mock('@/sea-metadata/components/popover/filter-popover/advanced-filters', () => () => null);

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

const openPalette = async () => {
  const modifyRowColor = jest.fn();
  const Example = () => {
    const [open, setOpen] = React.useState(false);
    return (
      <SeaMetadataContextProvider context={context}>
        <section data-sea-metadata-instance="main">
          <button id="color-trigger" onClick={() => setOpen(true)}>Row color</button>
        </section>
        {open && (
          <RowColorPopover
            target="color-trigger"
            columns={[]}
            colorbys={{ color_by_rules: [{ color: '#ffffff', filters: [] }] }}
            hidePopover={() => setOpen(false)}
            modifyRowColor={modifyRowColor}
          />
        )}
        <section data-sea-metadata-instance="dialog"><input aria-label="Other table" /></section>
      </SeaMetadataContextProvider>
    );
  };
  await act(async () => root.render(<Example />));
  await act(async () => { screen.getByText('Row color').focus(); screen.getByText('Row color').click(); });
  const paletteTrigger = document.querySelector('.seaqa-row-color-rule-color');
  await act(async () => paletteTrigger.click());
  expect(document.querySelector('.seaqa-color-selector-container')).not.toBeNull();
  return { paletteTrigger, modifyRowColor };
};

it('closes the nested palette before the row color popover and restores focus', async () => {
  const { paletteTrigger } = await openPalette();
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.seaqa-color-selector-container')).toBeNull();
  expect(document.querySelector('.seaqa-row-color-body')).not.toBeNull();
  expect(document.activeElement).toBe(paletteTrigger);
  await act(async () => fireEvent.keyDown(document.activeElement, { key: 'Escape', keyCode: 27, which: 27 }));
  expect(document.querySelector('.seaqa-row-color-body')).toBeNull();
  expect(document.activeElement).toBe(screen.getByText('Row color'));
});

it('ignores another table Escape and still applies a color from its own palette', async () => {
  const { modifyRowColor } = await openPalette();
  const other = screen.getByLabelText('Other table');
  await act(async () => { other.focus(); fireEvent.keyDown(other, { key: 'Escape', keyCode: 27, which: 27 }); });
  expect(document.querySelector('.seaqa-color-selector-container')).not.toBeNull();
  expect(document.querySelector('.seaqa-row-color-body')).not.toBeNull();
  await act(async () => document.querySelectorAll('.colorinput-color')[1].click());
  expect(modifyRowColor).toHaveBeenCalledTimes(1);
  expect(modifyRowColor.mock.calls[0][0].color_by_rules[0].color).toBe('#000000');
  expect(document.querySelector('.seaqa-color-selector-container')).toBeNull();
  expect(document.querySelector('.seaqa-row-color-body')).not.toBeNull();
  expect(document.activeElement).toBe(other);
});
