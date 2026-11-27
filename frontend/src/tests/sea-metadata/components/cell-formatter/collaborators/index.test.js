import React from 'react';
import { render } from '@testing-library/react';
import CollaboratorsFormatter from '@/sea-metadata/components/cell-formatter/collaborators';
import { CellType, TRANSFER_TYPES } from '@/sea-metadata/constants';
import DataProcessor from '@/sea-metadata/store/data-processor';
import { OPERATION_TYPE } from '@/sea-metadata/store/operations/constants';
import { getCellValueDisplayString, getCellValueStringResult } from '@/sea-metadata/utils/cell/common';
import setEventTransfer from '@/sea-metadata/utils/set-event-transfer';
import { parseEmailAddress } from '@/utils/email';

jest.mock('@/constants', () => ({ gettext: value => value, mediaUrl: '/media/' }));
jest.mock('@/components', () => ({
  Collaborator: jest.requireActual('@/components/collaborator/collaborator').default,
  UserAvatar: jest.requireActual('@/components/user-avatar').default,
}));

const column = {
  key: 'participants', name: 'participants', type: CellType.COLLABORATOR, data: { is_email_user: true },
};
const addresses = [
  'sales@example.com',
  'sales@another.com',
  '"sales@team"@example.com',
  'Sales Desk <sales@business.com>',
];
const labels = [
  'sales@example.com',
  'sales@another.com',
  '"sales@team"@example.com',
  'Sales Desk',
];
const rows = addresses.map((address, index) => ({ _id: String(index), participants: [address] }));

test('wide participant cells display full addresses while avatars keep their initials', () => {
  const { container } = render(<CollaboratorsFormatter column={column} value={addresses} />);

  expect(Array.from(container.querySelectorAll('.collaborator-name'), element => element.textContent)).toEqual(labels);
  expect(Array.from(container.querySelectorAll('.seaqa-svg-avatar-name'), element => element.textContent)).toEqual([
    'S', 'S', 'S', 'SD',
  ]);
  expect(getCellValueDisplayString({ participants: addresses }, column)).toBe(labels.join(', '));
});

test('parsed email objects use the same labels in rendering and text conversion', () => {
  const user = parseEmailAddress('sales@example.com');
  const { container } = render(<CollaboratorsFormatter column={column} value={[user]} />);

  expect(container.querySelector('.collaborator-name').textContent).toBe('sales@example.com');
  expect(container.querySelector('.collaborator').title).toBe('sales@example.com');
  expect(container.querySelector('.seaqa-svg-avatar-name').textContent).toBe('S');
  expect(getCellValueStringResult({ participants: [user] }, column)).toBe('sales@example.com');
});

test('ordinary collaborators keep their existing visible names', () => {
  const user = { name: 'Sales Desk', email: 'sales@example.com', avatar_url: '/avatar.png' };
  const regularColumn = { ...column, data: {} };
  const { container } = render(<CollaboratorsFormatter column={regularColumn} value={[user]} />);

  expect(container.querySelector('.collaborator-name').textContent).toBe('Sales Desk');
  expect(getCellValueDisplayString(
    { participants: [user.email] }, regularColumn, { collaborators: [user] }
  )).toBe('Sales Desk');
});

test('copying participant rows includes the visible full addresses', () => {
  const setData = jest.fn();
  setEventTransfer({
    type: TRANSFER_TYPES.METADATA_FRAGMENT,
    selectedRowIds: rows.map(row => row._id),
    tableData: { columns: [column] },
    rowGetterById: id => rows.find(row => row._id === id),
    event: { clipboardData: { setData } },
    collaborators: [],
  });

  expect(setData).toHaveBeenCalledWith(TRANSFER_TYPES.TEXT, labels.join('\n'));
});

test.each(labels.map((label, index) => [label, String(index)]))(
  'searching by the visible label %s finds the matching sender',
  (value, rowId) => {
    const table = { rows, view: { columns: [column], groupbys: [] } };
    new DataProcessor({}).syncOperationOnData(
      table, { op_type: OPERATION_TYPE.SEARCH_ROWS, value }, { collaborators: [] }
    );

    expect(table.view.rows).toEqual([rowId]);
  }
);
