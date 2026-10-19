import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormGroup, Label, InputGroup, Input } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { SettingsItem, toaster, IconTooltip, SaveStatus } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { usePortalSettings } from '../hooks';

import './index.css';

const Main = ({
  subdomainPublicUrl,
  domainAliasRoot,
  subdomainPrefix: propsSubdomainPrefix,
  onChange,
  createPreviewToken,
}) => {
  const [subdomainPrefix, setSubdomainPrefix] = useState(propsSubdomainPrefix || '');
  const [isOpeningPortalPreview, setIsOpeningPortalPreview] = useState(false);
  const subdomainPrefixEditVersion = useRef(0);
  const subdomainPrefixSyncedVersion = useRef(0);

  const isValidChanged = useMemo(() => {
    const validSubdomainPrefix = subdomainPrefix.trim();
    if (validSubdomainPrefix === propsSubdomainPrefix) return false;
    return true;
  }, [subdomainPrefix, propsSubdomainPrefix]);

  const onCopyUrl = useCallback((value) => {
    if (!value) return;
    copy(value);
    toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
  }, []);

  const onOpenPortalPreview = useCallback(() => {
    if (isOpeningPortalPreview) return;
    setIsOpeningPortalPreview(true);
    createPreviewToken().then(res => {
      window.open(res.data.preview_url, '_blank', 'noopener,noreferrer');
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
    }).finally(() => {
      setIsOpeningPortalPreview(false);
    });
  }, [isOpeningPortalPreview, createPreviewToken]);

  const handleCustomSubdomainPrefixChange = useCallback((callback) => {
    const validSubdomainPrefix = subdomainPrefix.trim();
    if (validSubdomainPrefix === propsSubdomainPrefix) {
      if (validSubdomainPrefix !== subdomainPrefix) {
        setSubdomainPrefix(validSubdomainPrefix);
      }
      return;
    }
    const editVersion = subdomainPrefixEditVersion.current;
    onChange && onChange({ subdomain_prefix: validSubdomainPrefix }, (isSuccess = true, errorMessage) => {
      if (isSuccess && subdomainPrefixEditVersion.current === editVersion) {
        subdomainPrefixSyncedVersion.current = editVersion;
      }
      callback && callback(isSuccess, errorMessage);
    });
  }, [subdomainPrefix, propsSubdomainPrefix, onChange]);

  useEffect(() => {
    if (subdomainPrefixEditVersion.current !== subdomainPrefixSyncedVersion.current) return;
    setSubdomainPrefix(propsSubdomainPrefix || '');
  }, [propsSubdomainPrefix]);

  return (
    <SettingsItem title={gettext('Portal domain')} className="seaqa-portal-domain-settings">
      <FormGroup className="mb-4">
        <Label>
          {gettext('Your current portal domain is')}
        </Label>
        <InputGroup className="seaqa-project-portal-input-group-settings">
          <Input
            type="text"
            className="portal-url-input"
            value={subdomainPublicUrl}
            readOnly
            disabled={true}
            placeholder={!domainAliasRoot ? gettext('Portal service root domain is not configured') : ''}
          />
          <IconTooltip
            icon="copy"
            tip={gettext('Copy URL')}
            disabled={!subdomainPublicUrl}
            className="mx-0 btn btn-secondary p-0"
            hoverBackground={true}
            size={{ btn: 38, icon: 14 }}
            placement="bottom"
            onClick={() => onCopyUrl(subdomainPublicUrl)}
          />
          <IconTooltip
            icon="open-in-new-tab"
            tip={gettext('Open preview')}
            disabled={isOpeningPortalPreview}
            className="mx-0 btn btn-secondary p-0"
            hoverBackground={true}
            size={{ btn: 38, icon: 14 }}
            placement="bottom"
            onClick={onOpenPortalPreview}
          />
        </InputGroup>
      </FormGroup>
      {domainAliasRoot ? (
        <FormGroup className="mb-4">
          <Label>{gettext('Customize the prefix:')}</Label>
          <SaveStatus isValidChanged={isValidChanged} callback={handleCustomSubdomainPrefixChange}>
            {({ callback }) => (
              <div className="seaqa-portal-customize-url-settings-container gap-2">
                <Input
                  type="text"
                  value={subdomainPrefix}
                  onChange={(event) => {
                    subdomainPrefixEditVersion.current += 1;
                    setSubdomainPrefix(event.target.value);
                  }}
                  placeholder={gettext('my-brand')}
                  spellCheck={false}
                  autoComplete="off"
                  onBlur={callback}
                />
                <Input
                  type="text"
                  value={`.${domainAliasRoot}`}
                  readOnly
                  disabled={true}
                />
              </div>
            )}
          </SaveStatus>
        </FormGroup>
      ) : (
        <p className="seaqa-tip-default m-0 mb-4 font-size-12 line-height-20">
          {gettext('Portal service root domain is not configured, so the default portal URL is unavailable.')}
        </p>
      )}
    </SettingsItem>
  );
};

const DomainSettings = () => {
  const { domainAliasSettings, updateDomainAliasSettings, createPreviewToken } = usePortalSettings();
  const { portal_service_root_domain, subdomain_prefix, public_url } = domainAliasSettings;

  return (
    <Main
      subdomainPublicUrl={public_url}
      domainAliasRoot={portal_service_root_domain}
      subdomainPrefix={subdomain_prefix}
      onChange={updateDomainAliasSettings}
      createPreviewToken={createPreviewToken}
    />
  );
};

export default DomainSettings;
