import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { portalAPI } from '@/portal/api';
import TeamEmails from '@/portal/main-panel/team-emails';
import SeaMetadata from '@/sea-metadata';

jest.mock('@/components', () => ({}));
jest.mock('@/constants', () => ({ gettext: text => text, PERMISSION_TYPES: { READ_ONLY: 'r' } }));
jest.mock('@/project/main-panel/connections/components/connection-resource-details', () => ({}));
jest.mock('@/portal/api', () => ({ portalAPI: { listTeamEmails: jest.fn() } }));
jest.mock('@/portal/path-utils', () => ({ getPortalPathSegments: () => ['emails'] }));
jest.mock('@/portal/main-panel/team-emails/constants', () => ({
  EMAIL_COLUMNS: [],
  EMAIL_VIEW_DATA: { _id: 'all' },
}));
jest.mock('@/sea-metadata', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  VIEW_TOOL: { FILTERS: 'filters', SORTS: 'sorts', GROUPBYS: 'groupbys' },
}));
jest.mock('@/sea-metadata/constants', () => ({}));
jest.mock('@/sea-metadata/context', () => ({}));

describe('Team emails local view', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let root;
  const renderEmailList = (projectUuid = 'project-1') => {
    act(() => root.render(<TeamEmails projectUuid={projectUuid} />));
    return SeaMetadata.mock.lastCall[0].api;
  };

  beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment; });
  beforeEach(() => { root = createRoot(document.createElement('div')); });
  afterEach(() => { act(() => root.unmount()); });

  test('keeps view options across renders without carrying them to a new page or project', async () => {
    const filters = [{ column_key: 'subject', filter_term: 'Support' }];
    const api = renderEmailList();
    await api.modifyView('all', { filters });
    await api.modifyView('all', { sorts: [{ column_key: 'processing_status' }] });

    const samePage = renderEmailList();
    expect((await samePage.getView()).data.view).toMatchObject({ filters, sorts: [{ column_key: 'processing_status' }] });

    const otherProject = renderEmailList('project-2');
    expect((await otherProject.getView()).data.view).toEqual({ _id: 'all' });

    act(() => root.render(null));
    const reopened = renderEmailList();
    expect((await reopened.getView()).data.view).toEqual({ _id: 'all' });
  });

  test('fetches only the requested page even when local view options are active', async () => {
    portalAPI.listTeamEmails.mockResolvedValue({
      data: { records: [{ _pk: 3, connection_id: 12 }], has_more: true },
    });
    const api = renderEmailList();
    await api.modifyView('all', { groupbys: [{ column_key: 'processing_status' }] });

    const result = await api.getMetadata({ start: 0, limit: 1 });

    expect(portalAPI.listTeamEmails).toHaveBeenCalledTimes(1);
    expect(portalAPI.listTeamEmails).toHaveBeenCalledWith('project-1', { start: 0, limit: 1 });
    expect(result.data).toMatchObject({ rows: [{ _pk: '12:3', thread_id: 3 }], has_more: true });
  });
});
