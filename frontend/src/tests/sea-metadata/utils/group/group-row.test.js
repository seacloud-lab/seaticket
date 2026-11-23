import { CellType } from '@/sea-metadata/constants';
import { getGroupRows } from '@/sea-metadata/utils/group/group-row';

jest.mock('@/constants', () => ({ gettext: value => value, mediaUrl: '/media/' }));

const column = {
  key: 'participants', name: 'participants', type: CellType.COLLABORATOR, data: { is_email_user: true },
};
const rows = [
  { _id: 'zoe', participants: ['Zoe <a@example.com>'] },
  { _id: 'empty', participants: [] },
  { _id: 'email', participants: ['m@example.com'] },
  { _id: 'alice', participants: ['Alice <z@example.com>'] },
];
const sortCases = [
  ['up', ['alice', 'email', 'zoe', 'empty']],
  ['down', ['zoe', 'email', 'alice', 'empty']],
];

test.each(sortCases)('sorts email participant groups %s by their visible labels', (sort_type, expected) => {
  const groups = getGroupRows(
    { columns: [column] }, rows, [{ column_key: column.key, sort_type }], { collaborators: [] }
  );

  expect(groups.map(group => group.row_ids[0])).toEqual(expected);
});

test.each(sortCases)('sorts nested email participant groups %s', (sort_type, expected) => {
  const categoryColumn = { key: 'category', name: 'category', type: CellType.TEXT };
  const groups = getGroupRows(
    { columns: [categoryColumn, column] }, rows.map(row => ({ ...row, category: 'Emails' })),
    [{ column_key: 'category' }, { column_key: column.key, sort_type }], { collaborators: [] }
  );

  expect(groups[0].subgroups.map(group => group.row_ids[0])).toEqual(expected);
});

test('keeps domain case variants in the same participant group', () => {
  const groups = getGroupRows(
    { columns: [column] }, [
      { _id: 'first', participants: ['Sales <sales@EXAMPLE.com>'] },
      { _id: 'second', participants: ['Sales Desk <sales@example.com>'] },
    ], [{ column_key: column.key, sort_type: 'up' }], { collaborators: [] }
  );

  expect(groups).toHaveLength(1);
  expect(groups[0].row_ids).toEqual(['first', 'second']);
});

test.each([
  ['up', ['second', 'first']],
  ['down', ['first', 'second']],
])('keeps ordinary collaborator groups sorting %s by collaborator names', (sort_type, expected) => {
  const regularColumn = { ...column, data: {} };
  const groups = getGroupRows(
    { columns: [regularColumn] }, [
      { _id: 'first', participants: ['a@example.com'] },
      { _id: 'second', participants: ['z@example.com'] },
    ], [{ column_key: column.key, sort_type }], {
      collaborators: [
        { email: 'a@example.com', name: 'Zoe' },
        { email: 'z@example.com', name: 'Alice' },
      ],
    }
  );

  expect(groups.map(group => group.row_ids[0])).toEqual(expected);
});
