import React, { act } from 'react';
import { fireEvent } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import Options from '@/components/options-editor/options';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components/centered-loading', () => () => null);
jest.mock('@/components/icon', () => () => null);

it('replaces the keyboard event filter when other option props stay the same', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { options: [{ value: 'a', name: 'A' }], onToggleOption: jest.fn() };
  try {
    act(() => root.render(<Options {...props} shouldHandleEvent={() => false} />));
    act(() => fireEvent.keyDown(container, { key: 'Enter', keyCode: 13, which: 13 }));
    expect(props.onToggleOption).not.toHaveBeenCalled();

    act(() => root.render(<Options {...props} shouldHandleEvent={() => true} />));
    act(() => fireEvent.keyDown(container, { key: 'Enter', keyCode: 13, which: 13 }));
    expect(props.onToggleOption).toHaveBeenCalledTimes(1);

    act(() => root.render(<Options {...props} shouldHandleEvent={() => false} />));
    act(() => fireEvent.keyDown(container, { key: 'Enter', keyCode: 13, which: 13 }));
    expect(props.onToggleOption).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});
