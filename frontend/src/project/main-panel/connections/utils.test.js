import { CONNECTION_FIELDS, CONNECTION_TYPE } from './constants';
import { getVisibleEmailFields, isEmailOAuthConfigValid, sanitizeEmailConfigByProvider } from './utils';

jest.mock('@/constants', () => ({ gettext: value => value }), { virtual: true });
jest.mock('@/components', () => ({}), { virtual: true });
jest.mock('@/sea-metadata/constants', () => ({}), { virtual: true });
jest.mock('@/sea-metadata/constants/column', () => ({ DATE_FORMAT_MAP: {} }), { virtual: true });
jest.mock('@/sea-metadata/constants/column/type', () => ({}), { virtual: true });
jest.mock('@/sea-metadata/utils/cell', () => ({}), { virtual: true });
jest.mock('@/sea-metadata/utils/column', () => ({}), { virtual: true });
jest.mock('@/sea-metadata/utils/row', () => ({}), { virtual: true });
jest.mock('@/utils/type-detection', () => ({}), { virtual: true });
jest.mock('../tickets/constants', () => ({}));

const fields = CONNECTION_FIELDS[CONNECTION_TYPE.EMAIL];

test('account options depend on provider', () => {
  const gmail = getVisibleEmailFields(fields, 'Gmail', false, 'personal');
  const microsoft = getVisibleEmailFields(fields, 'Microsoft', false, 'personal');
  expect(gmail.find(field => field.key === 'account_type').options.map(option => option.value)).toEqual(['personal', 'alias']);
  expect(microsoft.find(field => field.key === 'account_type').options.map(option => option.value)).toEqual(['personal', 'alias', 'shared']);
});

test.each([['Gmail', 'personal'], ['Gmail', 'alias'], ['Microsoft', 'personal'], ['Microsoft', 'alias'], ['Microsoft', 'shared']])(
  '%s %s supports either client mode independently', (provider, accountType) => {
    const config = { server_provider: provider, account_type: accountType, oauth_client_mode: 'custom',
      client_id: 'id', client_secret: 'secret', sender_email: 'alias@example.com' };
    expect(isEmailOAuthConfigValid(config, fields)).toBe(true);
    expect(sanitizeEmailConfigByProvider(config).client_id).toBe('id');
    expect(isEmailOAuthConfigValid({ ...config, client_secret: '' }, fields)).toBe(false);
    const defaultConfig = sanitizeEmailConfigByProvider({ ...config, oauth_client_mode: 'default' });
    expect(defaultConfig.client_id).toBeUndefined();
    expect(defaultConfig.client_secret).toBeUndefined();
    expect(isEmailOAuthConfigValid(defaultConfig, fields)).toBe(true);
    expect(defaultConfig.sender_email).toBe(accountType === 'personal' ? undefined : 'alias@example.com');
  }
);

test('alias sender and Microsoft URL validation are enforced', () => {
  expect(isEmailOAuthConfigValid({ server_provider: 'Gmail', account_type: 'alias' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Gmail', account_type: 'shared', sender_email: 'mail@example.com' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Microsoft', account_type: 'personal', oauth_client_mode: 'custom',
    client_id: 'id', client_secret: 'secret', token_url: 'https://evil.example/token' }, fields)).toBe(false);
});
