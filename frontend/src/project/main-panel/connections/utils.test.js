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
  const gmail = getVisibleEmailFields(fields, 'Gmail', 'personal');
  const microsoft = getVisibleEmailFields(fields, 'Microsoft', 'personal');
  expect(gmail.find(field => field.key === 'account_type')).toBeUndefined();
  expect(microsoft.find(field => field.key === 'account_type').options.map(option => option.value)).toEqual(['personal', 'shared']);
});

test.each([['Gmail', 'personal'], ['Microsoft', 'personal'], ['Microsoft', 'shared']])(
  '%s %s uses platform credentials', (provider, accountType) => {
    const config = { server_provider: provider, account_type: accountType, sender_email: 'shared@example.com' };
    expect(isEmailOAuthConfigValid(config, fields)).toBe(true);
    const defaultConfig = sanitizeEmailConfigByProvider({ ...config, oauth_client_mode: 'custom', client_id: 'id', client_secret: 'secret' });
    expect(defaultConfig.client_id).toBeUndefined();
    expect(defaultConfig.client_secret).toBeUndefined();
    expect(defaultConfig.oauth_client_mode).toBeUndefined();
    expect(isEmailOAuthConfigValid(defaultConfig, fields)).toBe(true);
    expect(defaultConfig.sender_email).toBe(accountType === 'personal' ? undefined : 'shared@example.com');
  }
);

test('unsupported account types and legacy custom applications are rejected', () => {
  expect(isEmailOAuthConfigValid({ server_provider: 'Gmail', account_type: 'alias' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Gmail', account_type: 'shared', sender_email: 'mail@example.com' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Microsoft', account_type: 'alias', sender_email: 'mail@example.com' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Microsoft', account_type: 'shared' }, fields)).toBe(false);
  expect(isEmailOAuthConfigValid({ server_provider: 'Microsoft', account_type: 'personal', oauth_client_mode: 'custom',
    client_id: 'id', client_secret: 'secret', token_url: 'https://evil.example/token' }, fields)).toBe(false);
});
