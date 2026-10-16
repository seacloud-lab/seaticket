import React, { useEffect, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { Icon, SettingsItem, toaster } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { usePortalSettings } from '../hooks';

import './index.css';

const CustomUrlSettings = () => {
  const { domainAliasSettings, updateDomainAliasSettings, createPreviewToken } = usePortalSettings();
  const { subdomain_prefix: savedToken, public_url: publicUrl } = domainAliasSettings;
  const [token, setToken] = useState(savedToken);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);

  useEffect(() => {
    setToken(savedToken);
  }, [savedToken]);

  const hasUnsavedToken = token !== savedToken;
  const canSave = hasUnsavedToken && !isSaving;
  const canCopy = !!publicUrl && !hasUnsavedToken && !isSaving;
  const urlPrefix = publicUrl.slice(0, -(savedToken.length + 1));

  const onSave = (event) => {
    event.preventDefault();
    if (!canSave) return;
    setError('');
    setIsSaving(true);
    updateDomainAliasSettings({ subdomain_prefix: token }, (isSuccess, errorMessage) => {
      if (isSuccess) {
        toaster.success(gettext('Saved'), { duration: 2, hasCloseButton: false });
      } else if (errorMessage) {
        setError(errorMessage === 'subdomain_prefix already in use.' ? gettext('This URL is already in use.') : errorMessage);
      }
    }).finally(() => setIsSaving(false));
  };

  const onCopy = () => {
    if (!canCopy) return;
    copy(publicUrl);
    toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
  };

  const onOpenPreview = () => {
    if (isOpeningPreview) return;
    setIsOpeningPreview(true);
    createPreviewToken().then(res => {
      window.open(res.data.preview_url, '_blank', 'noopener,noreferrer');
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => setIsOpeningPreview(false));
  };

  return (
    <SettingsItem title={gettext('Custom URL')} className="seaqa-portal-custom-url-settings">
      <form onSubmit={onSave} aria-busy={isSaving}>
        <FormGroup className="mb-4 seaqa-project-portal-input-group-settings">
          <Label for="portal-url-token">{gettext('Portal URL')}</Label>
          <div className="d-flex align-items-center gap-2">
            <div className="form-control portal-custom-url__editor">
              <span id="portal-url-prefix" className="portal-custom-url__prefix">{urlPrefix}</span>
              <Input
                id="portal-url-token"
                name="portal-url-token"
                type="text"
                className="portal-custom-url__token"
                value={token}
                onChange={event => {
                  setToken(event.target.value);
                  setError('');
                }}
                disabled={isSaving}
                required
                spellCheck={false}
                autoComplete="off"
                invalid={!!error}
                aria-describedby={`portal-url-prefix portal-url-token-help portal-url-token-warning${error ? ' portal-url-token-error' : ''}`}
              />
            </div>
            <Button
              color="secondary"
              type="button"
              className="portal-custom-url__action p-0"
              onClick={onCopy}
              disabled={!canCopy}
              title={gettext('Copy URL')}
              aria-label={gettext('Copy URL')}
              aria-describedby={!canCopy ? 'portal-url-copy-help' : undefined}
            >
              <Icon symbol="copy" />
            </Button>
            <Button
              color="secondary"
              type="button"
              className="portal-custom-url__action p-0"
              onClick={onOpenPreview}
              disabled={isOpeningPreview}
              title={gettext('Open preview')}
              aria-label={gettext('Open preview')}
            >
              <Icon symbol="open-in-new-tab" />
            </Button>
          </div>
          <p id="portal-url-token-help" className="seaqa-tip-default mt-2 mb-0 font-size-12 line-height-20">
            {gettext('Use 3–63 letters, numbers or hyphens. Start and end with a letter or number.')}
          </p>
          <p id="portal-url-token-warning" className="seaqa-tip-default mt-2 mb-0 font-size-12 line-height-20">
            {gettext('Changing the token will make the old portal URL unavailable.')}
          </p>
          {!canCopy && (
            <p id="portal-url-copy-help" className="seaqa-tip-default mt-2 mb-0 font-size-12 line-height-20">
              {gettext('Save the URL before copying.')}
            </p>
          )}
          {error && <p id="portal-url-token-error" className="text-danger mt-2 mb-0" role="alert">{error}</p>}
          <Button color="primary" size="sm" type="submit" className="mt-3" disabled={!canSave}>
            {isSaving ? gettext('Saving...') : gettext('Save')}
          </Button>
        </FormGroup>
      </form>
    </SettingsItem>
  );
};

export default CustomUrlSettings;
