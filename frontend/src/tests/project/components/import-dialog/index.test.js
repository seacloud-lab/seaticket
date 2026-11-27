import React, { act } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { knowledgeBaseAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import AllKnowledge from '@/project/main-panel/knowledge-base/view/all-knowledge';
import { SeaMetadataControllerProvider } from '@/sea-metadata/controller-provider';

const mockReload = jest.fn();
jest.mock('reactstrap', () => ({
  Modal: ({ children }) => <div>{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
  ModalFooter: ({ children }) => <div>{children}</div>,
  Button: ({ children, onClick, disabled }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));
jest.mock('@/components', () => ({
  ModalHeader: ({ children }) => <div>{children}</div>,
  Icon: () => null, CenteredLoading: () => null, Loading: () => null,
  toaster: { success: jest.fn(), danger: jest.fn(), warning: jest.fn() },
}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/constants/config', () => ({ siteRoot: '/' }));
jest.mock('@/project/api', () => ({ knowledgeBaseAPI: { importExcel: jest.fn(), queryIOStatus: jest.fn(), commitImportExcel: jest.fn() } }));
jest.mock('@/project/constants', () => ({ BAR_TYPE: { KNOWLEDGE: 'knowledge' } }));
jest.mock('@/project/hooks', () => ({ useData: jest.fn(), useTags: () => ({}) }));
jest.mock('@/project/components/resource-details-dialog', () => () => null);
jest.mock('@/project/main-panel/knowledge-base/hooks/knowledge-page', () => ({ useKnowledgePage: () => ({}) }));
jest.mock('@/project/main-panel/knowledge-base/utils', () => ({ generatorKnowledgeContextMenuOptions: () => [] }));
jest.mock('@/sea-metadata/utils/row', () => ({}));
jest.mock('@/utils/download', () => ({ getFileExtension: name => name.split('.').pop() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata', () => {
  const React = require('react');
  const { createMetadataContext } = require('@/sea-metadata/context');
  const { bindMetadataController } = require('@/sea-metadata/controller');
  const { EVENT_BUS_TYPE } = require('@/sea-metadata/constants');
  return {
    __esModule: true,
    ...jest.requireActual('@/sea-metadata/controller-provider'),
    default: React.forwardRef(({ controller, metadataID }, ref) => {
      const [context] = React.useState(createMetadataContext);
      React.useLayoutEffect(() => {
        const unbind = bindMetadataController(controller, { context }, metadataID);
        const unsubscribe = context.eventBus.subscribe(EVENT_BUS_TYPE.RELOAD_DATA, () => mockReload(metadataID));
        return () => { unsubscribe(); unbind(); context.destroy(); };
      }, [context, controller, metadataID]);
      return null;
    }),
  };
});

let ImportDialog;
let root;
let container;
let markTablesViewExpired;
const originalApp = window.app;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.app = { pageOptions: { projectUuid: 'project' } };
  ImportDialog = require('@/project/components/import-dialog').default;
});
afterAll(() => { window.app = originalApp; global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  markTablesViewExpired = jest.fn((_tables, callback) => callback());
  useData.mockReturnValue({ markTablesViewExpired });
  knowledgeBaseAPI.importExcel.mockResolvedValue({ data: { task_id: 'task' } });
  knowledgeBaseAPI.queryIOStatus.mockResolvedValue({ data: { is_finished: true, preview_rows: [{ title: 'Imported', content: 'Content' }], total_rows: 1, file_name: 'preview.xlsx' } });
  knowledgeBaseAPI.commitImportExcel.mockResolvedValue({ data: {} });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it.each(['knowledge', 'tickets'])('completes a side-panel import from %s outside the main-panel provider', async active => {
  const onClickBar = jest.fn();
  const onToggle = jest.fn();
  await act(async () => root.render(
    <>
      <SeaMetadataControllerProvider><AllKnowledge projectUuid="project" /></SeaMetadataControllerProvider>
      <SeaMetadataControllerProvider><AllKnowledge projectUuid="other-project" /></SeaMetadataControllerProvider>
      <ImportDialog activeBar={[active]} onClickBar={onClickBar} onToggle={onToggle} />
    </>
  ));
  const file = new File(['records'], 'records.xlsx');
  await act(async () => fireEvent.drop(container.querySelector('.upload-file-box'), { dataTransfer: { files: [file] } }));
  expect(knowledgeBaseAPI.importExcel).toHaveBeenCalledWith('project', file, true);
  await act(async () => screen.getByRole('button', { name: 'Import' }).click());

  expect(knowledgeBaseAPI.commitImportExcel).toHaveBeenCalledWith('project', 'preview.xlsx');
  expect(markTablesViewExpired).toHaveBeenCalledWith(['kb'], expect.any(Function));
  expect(onToggle).toHaveBeenCalledTimes(1);
  if (active === 'knowledge') {
    expect(mockReload.mock.calls).toEqual([['project-knowledge-main-project']]);
    expect(onClickBar).not.toHaveBeenCalled();
  } else {
    expect(onClickBar).toHaveBeenCalledWith(['knowledge']);
    expect(mockReload).not.toHaveBeenCalled();
  }
});
