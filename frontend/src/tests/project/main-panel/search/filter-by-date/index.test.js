import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FilterByDate from '../../../../../project/main-panel/search/filter-by-date';

jest.mock('../../../../../project/main-panel/search/filter-by-date/index.css', () => ({}));

jest.mock('../../../../../constants', () => ({
  gettext: (text) => text,
}));

jest.mock('@/components', () => {
  const React = require('react');

  const DatePicker = ({ onOpenChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
      const closeDatePicker = () => {
        if (!isOpen) return;
        setIsOpen(false);
        onOpenChange(false);
      };

      global.document.addEventListener('mousedown', closeDatePicker);
      return () => global.document.removeEventListener('mousedown', closeDatePicker);
    }, [isOpen, onOpenChange]);

    return (
      <button
        type="button"
        aria-label="Open date picker"
        onClick={() => {
          setIsOpen(true);
          onOpenChange(true);
        }}
      />
    );
  };

  const CustomizePopover = ({ canHidePopover, children, hidePopover }) => {
    const popoverRef = React.useRef(null);

    React.useEffect(() => {
      const closePopover = (event) => {
        if (canHidePopover && !popoverRef.current.contains(event.target)) {
          hidePopover(event);
        }
      };

      global.document.addEventListener('mousedown', closePopover);
      return () => global.document.removeEventListener('mousedown', closePopover);
    }, [canHidePopover, hidePopover]);

    return <div ref={popoverRef} data-testid="date-filter-popover">{children}</div>;
  };

  return {
    CustomizePopover,
    DatePicker,
    IconButton: () => null,
  };
}, { virtual: true });

jest.mock('@/components/customize-select/select-trigger', () => ({ onClick }) => (
  <button type="button" onClick={onClick}>Last modified time</button>
), { virtual: true });

const date = {
  type: 'last_updated_time',
  value: '',
  from: null,
  to: null,
};

const renderFilter = () => {
  render(<FilterByDate date={date} onChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Last modified time' }));
  fireEvent.click(screen.getByText('Custom time'));
};

describe('FilterByDate', () => {
  it.each([
    ['start date', 0],
    ['end date', 1],
  ])('closes the %s picker before closing the parent popover', async (_label, datePickerIndex) => {
    renderFilter();

    fireEvent.click(screen.getAllByRole('button', { name: 'Open date picker' })[datePickerIndex]);
    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('date-filter-popover')).not.toBeNull();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId('date-filter-popover')).toBeNull();
    });
  });
});
