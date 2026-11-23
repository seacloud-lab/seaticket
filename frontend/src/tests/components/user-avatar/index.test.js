import React from 'react';
import { render } from '@testing-library/react';
import UserAvatar from '@/components/user-avatar';

const user = { name: 'Sales Desk', email: 'sales@example.com', avatar_url: '/avatar.png' };

test.each([undefined, 14, 40])('keeps image and generated avatar sizes consistent for size=%s', (size) => {
  const { getByRole, rerender } = render(<UserAvatar user={user} size={size} />);
  const expectedSize = `${size === undefined ? 16 : size}px`;
  let avatarStyle = window.getComputedStyle(getByRole('img', { name: user.name }));

  expect(avatarStyle.width).toBe(expectedSize);
  expect(avatarStyle.height).toBe(expectedSize);

  rerender(<UserAvatar user={{ ...user, avatar_url: '' }} size={size} />);
  avatarStyle = window.getComputedStyle(getByRole('img', { name: user.name }));

  expect(avatarStyle.width).toBe(expectedSize);
  expect(avatarStyle.height).toBe(expectedSize);
});

test('resizes an existing image avatar when size changes', () => {
  const { getByRole, rerender } = render(<UserAvatar user={user} size={14} />);

  rerender(<UserAvatar user={user} size={40} />);

  const avatarStyle = window.getComputedStyle(getByRole('img', { name: user.name }));
  expect(avatarStyle.width).toBe('40px');
  expect(avatarStyle.height).toBe('40px');
});
