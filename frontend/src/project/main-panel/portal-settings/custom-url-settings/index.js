import React, { useMemo, useState } from 'react';
import { FormGroup, Input, InputGroup, Label } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { SettingsItem, toaster, SaveStatus, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { usePortalSettings } from '../hooks';

const CustomUrlSettings = () => {
  const { domainAliasSettings, updateDomainAliasSettings, createPreviewToken } = usePortalSettings();
  const { subdomain_prefix: savedToken, public_url: publicUrl } = domainAliasSettings;
  const [token, setToken] = useState(savedToken);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);

  const isValidChanged = useMemo(() => {
    if (token === savedToken) return false;
    if (!token.trim()) return false;
    return true;
  }, [token, savedToken]);

  const hasUnsavedToken = token !== savedToken;
  const canCopy = !!publicUrl && !hasUnsavedToken && !isSaving;
  const urlPrefix = publicUrl.slice(0, -(savedToken.length + 1));

  const onSave = (callback) => {
    const validValue = token.trim();
    if (!isValidChanged) {
      if (!validValue) setToken(savedToken);
      return;
    }
    setIsSaving(true);
    setToken(validValue);
    updateDomainAliasSettings({ subdomain_prefix: validValue }, (isSuccess, errorMessage) => {
      const tip = errorMessage === 'subdomain_prefix already in use.' ? gettext('This URL is already in use.') : errorMessage;
      callback && callback(isSuccess, tip);
      setIsSaving(false);
    });
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
      <FormGroup className="mb-4">
        <Label>{gettext('Portal URL')}</Label>
        <SaveStatus callback={onSave} isValidChanged={isValidChanged}>
          {({ callback }) => (
            <InputGroup className="seaqa-project-portal-input-group-settings">
              <Input value={urlPrefix} disabled readOnly />
              <Input
                type="text"
                value={token}
                onChange={event => setToken(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                onBlur={callback}
              />
              <IconTooltip
                icon="copy"
                tip={gettext('Copy URL')}
                disabled={!canCopy}
                className="mx-0 btn btn-secondary p-0"
                hoverBackground={true}
                size={{ btn: 38, icon: 14 }}
                placement="bottom"
                onClick={onCopy}
              />
              <IconTooltip
                icon="open-in-new-tab"
                disabled={isOpeningPreview}
                tip={gettext('Open preview')}
                className="mx-0 btn btn-secondary p-0"
                hoverBackground={true}
                size={{ btn: 38, icon: 14 }}
                placement="bottom"
                onClick={onOpenPreview}
              />
            </InputGroup>
          )}
        </SaveStatus>
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
      </FormGroup>
    </SettingsItem>
  );
};

export default CustomUrlSettings;
