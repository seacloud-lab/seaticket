import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OpFormatter from './index';

jest.mock('./index.css', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('../../../constants', () => ({
  CONNECTION_TYPE: { GITHUB_ISSUE: 'github_issue', DISCOURSE_FORUM: 'discourse_forum' },
}));
jest.mock('reactstrap', () => ({
  Dropdown: ({ children }) => <div>{children}</div>,
}));
jest.mock('@/components', () => ({
  IconButton: () => null,
  CustomizeDropdownMoreToggle: () => null,
  CustomizeDropdownMenu: ({ children }) => <div role="menu">{children}</div>,
  CustomizeDropdownItem: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

it('shows statistics for GitHub connections and passes the selected record', () => {
  const row = { id: 7, type: 'github_issue' };
  const onViewStatistics = jest.fn();
  render(<OpFormatter row={row} column={{ width: 100 }} onViewStatistics={onViewStatistics} />);
  fireEvent.click(screen.getByText('Statistics'));
  expect(onViewStatistics).toHaveBeenCalledWith(row);
});

it.each(['jira_issue', 'site', 'email', 'linear', 'seafile', 'general_task', 'discourse_forum', 'notion', 'confluence', 'discord'])(
  'hides statistics for %s without removing existing operations',
  type => {
    const row = { id: 8, type };
    const onMore = jest.fn();
    render(<OpFormatter row={row} column={{ width: 100 }} onViewStatistics={jest.fn()} onMore={onMore} />);
    expect(screen.queryByText('Statistics')).toBeNull();
    fireEvent.click(screen.getByText('Status'));
    expect(onMore).toHaveBeenCalledWith(row);
  }
);

it('does not show an empty menu when only statistics is provided for a non-GitHub connection', () => {
  render(<OpFormatter row={{ id: 8, type: 'jira_issue' }} column={{ width: 100 }} onViewStatistics={jest.fn()} />);
  expect(screen.queryByRole('menu')).toBeNull();
});
