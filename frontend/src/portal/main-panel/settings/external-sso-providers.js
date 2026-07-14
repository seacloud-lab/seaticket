import React, { useCallback, useEffect, useState } from 'react';
import { Button, Input } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { CommonOperationConfirmationDialog, Icon, Switch, toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { portalAPI } from '../../api';

const ExternalSSOProviders = ({ projectUuid }) => {
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [providerKey, setProviderKey] = useState('');
  const [providerName, setProviderName] = useState('');
  const [secret, setSecret] = useState('');
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const loadProviders = useCallback(() => {
    setIsLoading(true);
    portalAPI.listExternalSSOProviders(projectUuid).then(res => {
      setProviders(res.data?.providers || []);
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsLoading(false);
    });
  }, [projectUuid]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const copyValue = useCallback((value) => {
    if (!value) return;
    copy(value);
    toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
  }, []);

  const createProvider = useCallback(() => {
    const normalizedKey = providerKey.trim().toLowerCase();
    const normalizedName = providerName.trim();
    if (!normalizedKey || !normalizedName) {
      toaster.danger(gettext('Provider key and name are required.'));
      return;
    }
    if (secret && secret.length < 32) {
      toaster.danger(gettext('Shared secret must contain at least 32 characters.'));
      return;
    }

    setIsCreating(true);
    portalAPI.createExternalSSOProvider(projectUuid, {
      provider_key: normalizedKey,
      name: normalizedName,
      secret,
      enabled: 1,
    }).then(res => {
      setRevealedSecret(res.data);
      setProviderKey('');
      setProviderName('');
      setSecret('');
      loadProviders();
      toaster.success(gettext('SSO provider created'));
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsCreating(false);
    });
  }, [loadProviders, projectUuid, providerKey, providerName, secret]);

  const toggleProvider = useCallback((provider) => {
    const nextEnabled = !provider.enabled;
    portalAPI.updateExternalSSOProvider(projectUuid, provider.provider_key, {
      enabled: nextEnabled ? 1 : 0,
    }).then(res => {
      setProviders(current => current.map(item => (
        item.provider_key === provider.provider_key ? res.data : item
      )));
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [projectUuid]);

  const executePendingAction = useCallback(() => {
    if (!pendingAction) return Promise.resolve();
    const { type, provider } = pendingAction;
    if (type === 'delete') {
      return portalAPI.deleteExternalSSOProvider(projectUuid, provider.provider_key).then(() => {
        setProviders(current => current.filter(item => item.provider_key !== provider.provider_key));
        toaster.success(gettext('SSO provider deleted'));
      }).catch(error => {
        toaster.danger(Utils.getErrorMsg(error));
      }).finally(() => {
        setPendingAction(null);
      });
    }

    return portalAPI.resetExternalSSOProviderSecret(projectUuid, provider.provider_key).then(res => {
      setRevealedSecret(res.data);
      setProviders(current => current.map(item => (
        item.provider_key === provider.provider_key ? { ...item, updated_at: res.data.updated_at } : item
      )));
      toaster.success(gettext('Shared secret reset'));
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setPendingAction(null);
    });
  }, [pendingAction, projectUuid]);

  return (
    <div className="portal-settings-content portal-sso-providers">
      <div className="portal-sso-provider-create">
        <label className="portal-settings-label">{gettext('Add SSO provider')}</label>
        <p className="portal-settings-help-text">
          {gettext('The third-party system must generate an HS256 JWT with this shared secret.')}
        </p>
        <div className="portal-sso-provider-form">
          <div>
            <label htmlFor="portal-sso-provider-key">{gettext('Provider key')}</label>
            <Input
              id="portal-sso-provider-key"
              value={providerKey}
              onChange={event => setProviderKey(event.target.value)}
              placeholder={gettext('customer-system')}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="portal-sso-provider-name">{gettext('Provider name')}</label>
            <Input
              id="portal-sso-provider-name"
              value={providerName}
              onChange={event => setProviderName(event.target.value)}
              placeholder={gettext('Customer system')}
              autoComplete="off"
            />
          </div>
          <div className="portal-sso-provider-secret-field">
            <label htmlFor="portal-sso-provider-secret">{gettext('Shared secret')}</label>
            <Input
              id="portal-sso-provider-secret"
              type="password"
              value={secret}
              onChange={event => setSecret(event.target.value)}
              placeholder={gettext('Leave empty to generate a secret')}
              autoComplete="new-password"
            />
          </div>
          <div className="portal-sso-provider-create-action">
            <Button color="primary" onClick={createProvider} disabled={isCreating}>
              {isCreating ? gettext('Creating...') : gettext('Add provider')}
            </Button>
          </div>
        </div>
      </div>

      {revealedSecret && (
        <div className="portal-sso-provider-secret-result" role="status">
          <div className="font-weight-bold">{gettext('Save this shared secret now')}</div>
          <p className="portal-settings-help-text mb-2">
            {gettext('For security, the shared secret will not be shown again.')}
          </p>
          <div className="portal-url-container">
            <Input value={revealedSecret.secret || ''} readOnly aria-label={gettext('Shared secret')} />
            <Button color="outline-primary" onClick={() => copyValue(revealedSecret.secret)} title={gettext('Copy secret')}>
              <Icon symbol="copy" />
            </Button>
          </div>
          <div className="portal-url-container mt-2">
            <Input value={revealedSecret.login_url || ''} readOnly aria-label={gettext('Login URL')} />
            <Button color="outline-primary" onClick={() => copyValue(revealedSecret.login_url)} title={gettext('Copy login URL')}>
              <Icon symbol="copy" />
            </Button>
          </div>
          <Button color="link" className="px-0 mt-1" onClick={() => setRevealedSecret(null)}>
            {gettext('Dismiss')}
          </Button>
        </div>
      )}

      <div className="portal-sso-provider-list">
        <label className="portal-settings-label">{gettext('Configured providers')}</label>
        {isLoading && <p className="portal-settings-help-text">{gettext('Loading...')}</p>}
        {!isLoading && providers.length === 0 && (
          <p className="portal-settings-help-text">{gettext('No SSO providers')}</p>
        )}
        {!isLoading && providers.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm portal-sso-provider-table">
              <thead>
                <tr>
                  <th>{gettext('Provider')}</th>
                  <th>{gettext('Login URL')}</th>
                  <th>{gettext('Enabled')}</th>
                  <th aria-label={gettext('Actions')} />
                </tr>
              </thead>
              <tbody>
                {providers.map(provider => (
                  <tr key={provider.provider_key}>
                    <td className="align-middle">
                      <div>{provider.name}</div>
                      <div className="portal-sso-provider-key">{provider.provider_key}</div>
                    </td>
                    <td className="align-middle">
                      <div className="portal-sso-provider-url">
                        <span title={provider.login_url}>{provider.login_url || '-'}</span>
                        <Button
                          color="link"
                          className="portal-sso-provider-copy-btn"
                          onClick={() => copyValue(provider.login_url)}
                          disabled={!provider.login_url}
                          title={gettext('Copy login URL')}
                        >
                          <Icon symbol="copy" />
                        </Button>
                      </div>
                    </td>
                    <td className="align-middle">
                      <Switch
                        checked={provider.enabled}
                        onChange={() => toggleProvider(provider)}
                        textPosition="right"
                        placeholder={provider.enabled ? gettext('Enabled') : gettext('Disabled')}
                      />
                    </td>
                    <td className="align-middle text-right portal-sso-provider-actions">
                      <Button color="link" size="sm" onClick={() => setPendingAction({ type: 'reset', provider })}>
                        {gettext('Reset secret')}
                      </Button>
                      <Button color="link" size="sm" className="text-danger" onClick={() => setPendingAction({ type: 'delete', provider })}>
                        {gettext('Delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingAction && (
        <CommonOperationConfirmationDialog
          title={pendingAction.type === 'delete' ? gettext('Delete SSO provider') : gettext('Reset shared secret')}
          message={pendingAction.type === 'delete'
            ? gettext('The third-party system will no longer be able to sign in through this provider.')
            : gettext('The current shared secret will stop working immediately. Update the third-party system with the new secret.')}
          confirmBtnText={pendingAction.type === 'delete' ? gettext('Delete') : gettext('Reset')}
          executeOperation={executePendingAction}
          toggleDialog={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default ExternalSSOProviders;
