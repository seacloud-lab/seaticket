import React, { act } from 'react';
import { createEvent, fireEvent } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import AllViews from '@/sea-metadata/components/view-toolbar/views/all-views';
import ViewItem from '@/sea-metadata/components/view-toolbar/views/view-item';
import { createMetadataContext } from '@/sea-metadata/context';
import { SeaMetadataContextProvider } from '@/sea-metadata/context-provider';

jest.mock('@/constants', () => ({ gettext: text => text, KeyCodes: {} }));
jest.mock('@/components', () => {
  const React = require('react');
  return {
    Icon: () => null,
    IconButton: React.forwardRef(({ children, onClick }, ref) => <button ref={ref} onClick={onClick}>{children}</button>),
    SearchInput: () => null,
    CustomizeDropdownItemText: ({ children }) => <span>{children}</span>,
    EmptyTip: () => null,
  };
});
jest.mock('@/sea-metadata/components/popover/scoped-popover', () => ({ children }) => <div>{children}</div>);

const dataTransfer = () => {
  const data = new Map();
  return {
    setData: (type, value) => data.set(type, String(value)),
    getData: type => data.get(type) || '',
    setDragImage: jest.fn(),
    dropEffect: 'move',
  };
};
const views = [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }];
const cases = ['tab', 'menu'].flatMap(source => ['tab', 'menu'].map(target => ({ source, target })));

it.each(cases)('isolates $source to $target view drags while preserving reordering inside one table', ({ source, target }) => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const contexts = ['main', 'dialog'].map(id => Object.assign(createMetadataContext(), { id }));
  const move = [jest.fn(), jest.fn()];
  const item = (table, surface, viewID) => {
    const section = container.querySelector(`[data-table="${table}"]`);
    return surface === 'tab'
      ? section.querySelector(`#${table}-view-${viewID}`)
      : Array.from(section.querySelectorAll('.sea-metadata-all-views-item')).find(node => node.textContent === viewID.toUpperCase());
  };
  const dragOver = (node, transfer) => {
    const event = createEvent.dragOver(node, { dataTransfer: transfer });
    Object.defineProperties(event, { offsetX: { value: 0 }, offsetY: { value: 0 } });
    act(() => fireEvent(node, event));
  };

  try {
    act(() => root.render(contexts.map((context, index) => (
      <SeaMetadataContextProvider key={context.id} context={context}>
        <section data-table={context.id}>
          {views.map(view => <ViewItem key={view._id} view={view} moveAble onMove={move[index]} />)}
          <AllViews allViews={views} onMove={move[index]} />
        </section>
      </SeaMetadataContextProvider>
    ))));
    act(() => container.querySelectorAll('button').forEach(button => button.click()));
    const transfer = dataTransfer();
    const dragSource = item('main', source, 'a');
    act(() => fireEvent.dragStart(source === 'menu' ? dragSource.firstChild : dragSource, { dataTransfer: transfer }));

    const foreignTarget = item('dialog', target, 'b');
    dragOver(foreignTarget, transfer);
    act(() => fireEvent.drop(foreignTarget, { dataTransfer: transfer }));
    expect(move[1]).not.toHaveBeenCalled();
    expect(foreignTarget.className).not.toMatch(/next-position/);

    const ownTarget = item('main', target, 'b');
    dragOver(ownTarget, transfer);
    act(() => fireEvent.drop(ownTarget, { dataTransfer: transfer }));
    expect(move[0]).toHaveBeenCalledTimes(1);
    expect(move[0]).toHaveBeenCalledWith('a', 'b', 'before');

    // Plain text from another application is not a view reorder command.
    const text = dataTransfer();
    text.setData('text/plain', 'a');
    dragOver(ownTarget, text);
    act(() => fireEvent.drop(ownTarget, { dataTransfer: text }));
    expect(move[0]).toHaveBeenCalledTimes(1);
    expect(ownTarget.className).not.toMatch(/next-position/);
  } finally {
    act(() => root.unmount());
    contexts.forEach(context => context.destroy());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});
