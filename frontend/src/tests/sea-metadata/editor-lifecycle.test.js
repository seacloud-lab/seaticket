import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SeaMetadata from '@/sea-metadata/render';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({ CenteredLoading: () => null, toaster: { danger: jest.fn(), success: jest.fn() } }));
jest.mock('@/components/toaster', () => ({ danger: jest.fn(), success: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata/components/view-toolbar', () => () => null);
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/view/table/editors/editor-container/editor', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ getValue: () => ({ title: 'Edited' }) }));
    return <span>Editing</span>;
  });
});
jest.mock('@/sea-metadata/view', () => ({ CustomView }) => {
  const { useMetadata } = require('@/sea-metadata/hooks/metadata');
  const { metadata, modifyRow } = useMetadata();
  if (!metadata.rows.length) return null;
  return (
    <CustomView
      row={metadata.rows[0]}
      column={metadata.columns[0]}
      value="Original"
      onCommit={({ rowId, rowUpdate, oldRowData }) => modifyRow(rowId, rowUpdate, oldRowData)}
      onCommitCancel={() => {}}
    />
  );
});

const editors = [
  ['normal', require('@/sea-metadata/view/table/editors/editor-container/normal-editor-container').default],
  ['popup', require('@/sea-metadata/view/table/editors/editor-container/popup-editor-container').default],
];
const cases = editors.flatMap(([name, Editor]) => [
  { name, Editor, replace: false },
  { name, Editor, replace: true },
]);

it.each(cases)('saves pending $name editor changes to the original API on unmount (replacement: $replace)', async ({ name, Editor, replace }) => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const view = { _id: 'view', type: 'table', columns_keys: ['title'], sorts: [], filters: [], groupbys: [] };
  const api = {
    getViews: jest.fn(async () => ({ data: { views: [view], navigation: [{ _id: 'view', type: 'view' }] } })),
    getView: jest.fn(async () => ({ data: { view } })),
    getMetadata: jest.fn(async () => ({ data: { rows: [{ _id: 'row', title: 'Original' }], columns: [{ key: 'title', name: 'Title', type: 'text', editable: true }] } })),
    modifyRow: jest.fn(async () => ({ data: {} })),
  };
  try {
    await act(async () => root.render(<SeaMetadata metadataID={`unmount-${name}`} api={api} permission="rw" CustomView={Editor} />));
    expect(container.textContent).toBe('Editing');
    const replacementAPI = { ...api, modifyRow: jest.fn(async () => ({ data: {} })) };
    await act(async () => root.render(replace ? <SeaMetadata metadataID={`replacement-${name}`} api={replacementAPI} permission="rw" CustomView={Editor} /> : null));
    expect(api.modifyRow).toHaveBeenCalledTimes(1);
    expect(api.modifyRow).toHaveBeenCalledWith('row', { title: 'Edited' }, false, expect.any(Object));
    expect(replacementAPI.modifyRow).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
});
