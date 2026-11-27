import React, { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import StaticSelect from '@/components/customize-select/static-select';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/components', () => ({ IconButton: () => null }));
jest.mock('@/components/icon', () => () => null);
jest.mock('@/components/modal-portal', () => ({ children }) => require('react-dom').createPortal(children, global.document.body));

it('only changes the active select when two portalled menus are open', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const firstChange = jest.fn();
  const secondChange = jest.fn();
  try {
    act(() => root.render(
      <>
        <StaticSelect placeholder="First" isInModal options={[{ value: 'a', label: 'A' }]} onChange={firstChange} />
        <StaticSelect placeholder="Second" isInModal options={[{ value: 'b', label: 'B' }]} onChange={secondChange} />
      </>
    ));
    act(() => screen.getByText('First').click());
    act(() => jest.runOnlyPendingTimers());
    act(() => screen.getByText('Second').click());
    act(() => jest.runOnlyPendingTimers());
    expect(document.querySelectorAll('.seaqa-select-options-container')).toHaveLength(2);
    act(() => fireEvent.keyDown(document.activeElement, { keyCode: 40 }));
    act(() => fireEvent.keyDown(document.activeElement, { keyCode: 13 }));
    expect(firstChange).not.toHaveBeenCalled();
    expect(secondChange).toHaveBeenCalledWith('b');
  } finally {
    act(() => root.unmount());
    jest.useRealTimers();
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});

it('does not steal focus back after the user moves to another dialog before layout settles', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    act(() => root.render(
      <>
        <StaticSelect placeholder="Select" isInModal options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />
        <div role="dialog"><input aria-label="Another dialog" /></div>
      </>
    ));
    act(() => screen.getByText('Select').click());
    const input = screen.getByLabelText('Another dialog');
    act(() => input.focus());
    act(() => jest.runOnlyPendingTimers());
    expect(document.activeElement).toBe(input);
  } finally {
    act(() => root.unmount());
    jest.useRealTimers();
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});
