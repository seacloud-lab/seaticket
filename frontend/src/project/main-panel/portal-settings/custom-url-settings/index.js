import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FormGroup, Input, InputGroup, Label } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { SettingsItem, toaster, SaveStatus, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { isEnterWithoutComposition } from '@/utils/hotkey';
import { Utils } from '@/utils/utils';
import { usePortalSettings } from '../hooks';
import { getInputCheckError } from '../utils';

const CustomUrlSettings = () => {
  const { domainAliasSettings, updateDomainAliasSettings, createPreviewToken } = usePortalSettings();
  const { subdomain_prefix: savedToken, public_url: publicUrl } = domainAliasSettings;
  const [token, setToken] = useState(savedToken);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const [lastSavedTokenValue, setLastSavedTokenValue] = useState(savedToken);

  const tokenEditVersion = useRef(0);
  const tokenSaveSequence = useRef(0);
  const pendingTokenSave = useRef(null);
  const lastSavedToken = useRef(savedToken);
  const inputRef = useRef(null);

  useEffect(() => {
    if (lastSavedToken.current === savedToken) return;
    lastSavedToken.current = savedToken;
    setLastSavedTokenValue(savedToken);
  }, [savedToken]);

  const expectedToken = pendingTokenSave.current?.value ?? lastSavedTokenValue ?? savedToken;
  const hasUnsavedToken = token.trim() !== expectedToken;
  const canCopy = !!publicUrl && !hasUnsavedToken && !isSaving;
  const urlPrefix = publicUrl.slice(0, -(savedToken.length + 1));

  const onKeyDown = useCallback((event) => {
    if (isEnterWithoutComposition(event)) {
      event.preventDefault();
      inputRef?.current?.blur();
    }
  }, []);

  const onSave = (callback) => {
    const validValue = token.trim();
    if (!validValue) {
      setToken(savedToken);
      callback && callback({
        error: getInputCheckError(gettext('%s is invalid and has been automatically reset to the last valid value.').replace('%s', 'Subdomain prefix')),
      });
      return;
    }
    const editVersion = tokenEditVersion.current;
    const saveSequence = ++tokenSaveSequence.current;
    pendingTokenSave.current = { sequence: saveSequence, value: validValue };
    setIsSaving(true);
    setToken(validValue);
    updateDomainAliasSettings({ subdomain_prefix: validValue }, ({ error } = {}, savedSettings = {}) => {
      if (!error) {
        const persistedToken = savedSettings?.subdomain_prefix || validValue;
        lastSavedToken.current = persistedToken;
        setLastSavedTokenValue(persistedToken);
        if (tokenEditVersion.current === editVersion) setToken(persistedToken);
      }
      callback && callback({ error });
      if (pendingTokenSave.current?.sequence === saveSequence) {
        pendingTokenSave.current = null;
        setIsSaving(false);
      }
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
        <SaveStatus type="input" callback={onSave}>
          {({ callback, onContentChange }) => (
            <InputGroup className="seaqa-project-portal-input-group-settings">
              <Input value={urlPrefix} disabled readOnly />
              <Input
                type="text"
                innerRef={inputRef}
                value={token}
                onChange={event => {
                  onContentChange();
                  tokenEditVersion.current += 1;
                  setToken(event.target.value);
                }}
                spellCheck={false}
                autoComplete="off"
                onBlur={() => {
                  const currentPendingToken = pendingTokenSave.current?.value;
                  const expectedToken = currentPendingToken ?? lastSavedToken.current ?? savedToken;
                  if (token.trim() !== expectedToken) callback();
                }}
                onKeyDown={onKeyDown}
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
                disabled={!canCopy || isOpeningPreview}
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
