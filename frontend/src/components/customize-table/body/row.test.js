import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import Row from './row';

it('passes the selected record to an optional row context-menu callback', () => {
  const row = { id: 8 };
  const onRowContextMenu = jest.fn();
  const { container } = render(<Row row={row} columns={[]} onRowContextMenu={onRowContextMenu} />);
  fireEvent.contextMenu(container.firstChild);
  expect(onRowContextMenu).toHaveBeenCalledWith(expect.anything(), row);
});

it('preserves the native menu when no callback is provided', () => {
  const { container } = render(<Row row={{ id: 8 }} columns={[]} />);
  expect(fireEvent.contextMenu(container.firstChild)).toBe(true);
});
