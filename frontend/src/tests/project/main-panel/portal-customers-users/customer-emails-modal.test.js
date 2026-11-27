import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import CustomerEmailsModal from '@/project/main-panel/portal-customers-users/customer-emails-modal';
import SeaMetadata from '@/sea-metadata';
import { CANVAS_RIGHT_INTERVAL, SEQUENCE_COLUMN_WIDTH } from '@/sea-metadata/constants/view/table';
import { createSeaMetadataController } from '@/sea-metadata/controller';

jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/components', () => ({
  Collaborator: () => null,
  CenteredLoading: () => null,
  ModalHeader: () => <header>Customer emails</header>,
  toaster: { danger: jest.fn() },
}));
jest.mock('@/components/toaster', () => ({ danger: jest.fn() }));
jest.mock('@/portal/api', () => ({ portalAPI: { listCustomerEmails: jest.fn() } }));
jest.mock('@/project/main-panel/tickets/constants', () => ({ TICKET_STATE_OPTIONS: [] }));
jest.mock('@/project/utils', () => ({ getInternalNetworkAddress: jest.fn() }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));
jest.mock('@/sea-metadata', () => ({
  __esModule: true,
  default: require('@/sea-metadata/render').default,
  ...jest.requireActual('@/sea-metadata/controller-provider'),
  CellType: jest.requireActual('@/sea-metadata/constants').CellType,
}));
jest.mock('@/sea-metadata/components/view-toolbar', () => () => null);
jest.mock('@/sea-metadata/hooks/collaborators', () => ({ useCollaborators: () => ({ collaborators: [], collaboratorsCache: {} }) }));
jest.mock('@/sea-metadata/view', () => () => {
  const { useMetadata } = require('@/sea-metadata/hooks/metadata');
  const { metadata } = useMetadata();
  return <output>{JSON.stringify(metadata.columns.map(({ name, width }) => ({ name, width })))}</output>;
});

let root;
let container;
let observers;
const originalResizeObserver = global.ResizeObserver;
const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  window.localStorage.clear();
  portalAPI.listCustomerEmails.mockResolvedValue({ data: { records: [] } });
  observers = [];
  global.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe = jest.fn();
    disconnect = jest.fn();
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  global.ResizeObserver = originalResizeObserver;
});

it('fits the subject column to the existing modal body and disconnects when closing', async () => {
  await act(async () => root.render(<CustomerEmailsModal projectUuid="project" customer={{ id: 1, name: 'Customer' }} onClose={() => {}} />));
  await act(async () => jest.advanceTimersByTime(350));
  const body = document.querySelector('.portal-customer-emails-dialog .modal-body');
  expect(body.classList.contains('p-0')).toBe(true);
  expect(body.firstElementChild.classList.contains('sea-metadata-instance')).toBe(true);
  expect(observers).toHaveLength(1);
  expect(observers[0].observe).toHaveBeenCalledWith(body);
  Object.defineProperty(body, 'clientWidth', { configurable: true, value: 1800 });

  await act(async () => {
    observers[0].callback();
    jest.runOnlyPendingTimers();
  });

  const columns = JSON.parse(body.querySelector('output').textContent);
  const otherColumnsWidth = columns.filter(column => column.name !== 'title').reduce((total, column) => total + column.width, 0);
  expect(columns.find(column => column.name === 'title').width).toBe(1800 - SEQUENCE_COLUMN_WIDTH - CANVAS_RIGHT_INTERVAL - otherColumnsWidth);
  expect(portalAPI.listCustomerEmails).toHaveBeenCalledTimes(2);

  await act(async () => root.render(null));
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
});

it('cancels a pending resize reload before the controller binds to a replacement table', async () => {
  const controller = createSeaMetadataController('customer-emails-project-1');
  await act(async () => root.render(<CustomerEmailsModal controller={controller} projectUuid="project" customer={{ id: 1, name: 'Customer' }} onClose={() => {}} />));
  await act(async () => jest.advanceTimersByTime(350));
  const body = document.querySelector('.portal-customer-emails-dialog .modal-body');
  Object.defineProperty(body, 'clientWidth', { configurable: true, value: 1800 });
  const api = {
    getViews: () => Promise.resolve({ data: { views: [{ _id: 'all' }], navigation: [{ _id: 'all', type: 'view' }] } }),
    getView: () => Promise.resolve({ data: { view: { _id: 'all', type: 'table' } } }),
    getMetadata: jest.fn(async () => ({ data: { rows: [], columns: [] } })),
  };
  await act(async () => {
    observers[0].callback();
    root.render(<SeaMetadata controller={controller} api={api} />);
  });
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  expect(api.getMetadata).toHaveBeenCalledTimes(1);

  await act(async () => jest.runOnlyPendingTimers());

  expect(api.getMetadata).toHaveBeenCalledTimes(1);
});
