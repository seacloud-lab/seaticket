import { BAR_TYPE } from '@/project/constants/bar';
import { getMyTicketsBar, getMyTicketsScope, getMyTicketsURL } from '@/project/utils';

jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/main-panel/connections/utils', () => ({}));
jest.mock('@/project/main-panel/portal-issues/utils', () => ({}));
jest.mock('@/project/main-panel/tickets/utils', () => ({}));

describe('My tickets route helpers', () => {
  it.each([
    ['', BAR_TYPE.MY_TICKET, 'assigned'],
    ['?scope=unknown', BAR_TYPE.MY_TICKET, 'assigned'],
    ['?scope=created&view=created-closed', BAR_TYPE.MY_CREATED_TICKET, 'created'],
  ])('resolves the sidebar and scope from %j', (search, expectedBar, expectedScope) => {
    const bar = getMyTicketsBar(search);
    expect(bar).toBe(expectedBar);
    expect(getMyTicketsScope(bar)).toBe(expectedScope);
  });

  it('does not assign a My Tickets scope to All Tickets', () => {
    expect(getMyTicketsScope(BAR_TYPE.TICKET)).toBeNull();
  });

  it.each([
    ['created', '?view=created-closed', '?view=created-closed&scope=created'],
    ['assigned', '?scope=created&view=closed', '?view=closed'],
    ['assigned', '?scope=created', ''],
  ])('builds the shared URL for scope %s from %j', (scope, search, query) => {
    const projectURL = '/workspace/1/project/demo/';
    expect(getMyTicketsURL(projectURL, scope, search)).toBe(`${projectURL}my-tickets/${query}`);
  });
});
