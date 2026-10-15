import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormGroup, Input, InputGroup, Label } from 'reactstrap';
import copy from 'copy-to-clipboard';
import { CommonOperationConfirmationDialog, SettingsItem, toaster, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { usePortalSettings } from '../hooks';

import './index.css';

const getHostFromUrl = (value) => {
  if (!value) return '';
  try {
    return new URL(value).host;
  } catch (error) {
    return '';
  }
};

const Main = ({
  customDomain: propsCustomDomain,
  subdomainPublicUrl,
  customDomainVerified,
  customDomainTxtRecordName,
  customDomainTxtRecordValue,
  currentSubdomainDomain,
  onChange,
  verifyCustomDomain,
}) => {
  const [customDomain, setCustomDomain] = useState(propsCustomDomain || '');
  const [isShowRemoveCustomDomainConfirm, setIsShowRemoveCustomDomainConfirm] = useState(false);
  const [isVerifyingCustomDomain, setIsVerifyingCustomDomain] = useState(false);
  const customDomainEditVersion = useRef(0);
  const customDomainSyncedVersion = useRef(0);

  const validCustomDomain = useMemo(() => customDomain.trim(), [customDomain]);
  const currentPortalDomain = useMemo(() => currentSubdomainDomain || getHostFromUrl(subdomainPublicUrl),
    [currentSubdomainDomain, subdomainPublicUrl]);
  const customDomainHint = useMemo(() => currentPortalDomain
    ? gettext('Custom domain allows you to serve your portal from a domain other than {domain}.').replace('{domain}', currentPortalDomain)
    : gettext('Custom domain allows you to serve your portal from a domain other than your current portal domain.'),
  [currentPortalDomain]);

  const handleCustomDomainChange = useCallback(() => {
    if (!validCustomDomain) return;
    if (validCustomDomain === propsCustomDomain) {
      return;
    }
    const editVersion = customDomainEditVersion.current;
    onChange && onChange({ custom_domain: validCustomDomain }, (isSuccess = true) => {
      if (isSuccess && customDomainEditVersion.current === editVersion) {
        customDomainSyncedVersion.current = editVersion;
      }
    });
  }, [validCustomDomain, propsCustomDomain, onChange]);

  const onOpenRemoveCustomDomainConfirm = useCallback(() => {
    if (!validCustomDomain) return;
    setIsShowRemoveCustomDomainConfirm(true);
  }, [validCustomDomain]);

  const onCloseRemoveCustomDomainConfirm = useCallback(() => {
    setIsShowRemoveCustomDomainConfirm(false);
  }, []);

  const onRemoveCustomDomain = useCallback(() => {
    if (!validCustomDomain) return;
    const editVersion = customDomainEditVersion.current;
    onChange && onChange({ custom_domain: '' }, (isSuccess = true) => {
      if (!isSuccess) return;
      if (customDomainEditVersion.current === editVersion) {
        customDomainSyncedVersion.current = editVersion;
        setCustomDomain('');
      }
    });
  }, [validCustomDomain, onChange]);

  const onVerifyCustomDomain = useCallback(() => {
    if (!propsCustomDomain || isVerifyingCustomDomain) {
      return;
    }

    setIsVerifyingCustomDomain(true);
    verifyCustomDomain().then(() => {
      toaster.success(gettext('Verified'), { duration: 2, hasCloseButton: false });
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsVerifyingCustomDomain(false);
    });
  }, [propsCustomDomain, isVerifyingCustomDomain, verifyCustomDomain]);

  const onCopyUrl = useCallback((value) => {
    if (!value) return;
    copy(value);
    toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
  }, []);

  useEffect(() => {
    if (customDomainEditVersion.current !== customDomainSyncedVersion.current) return;
    setCustomDomain(propsCustomDomain || '');
  }, [propsCustomDomain]);

  const hasUnsavedCustomDomain = validCustomDomain !== propsCustomDomain;
  const isSavedCustomDomainCurrent = !!propsCustomDomain && !hasUnsavedCustomDomain;
  const canVerifyCustomDomain = isSavedCustomDomainCurrent && !customDomainVerified && !isVerifyingCustomDomain;

  return (
    <SettingsItem title={gettext('Custom domain')} className="seaqa-portal-custom-domain-settings">
      <FormGroup className={propsCustomDomain ? 'mb-2' : 'mb-4'}>
        <Label className="seaqa-tip-default font-size-12 line-height-20 mb-4">{customDomainHint}</Label>
        <InputGroup className="seaqa-project-portal-input-group-settings">
          <Input
            type="text"
            className="custom-domain-input"
            value={customDomain}
            placeholder={gettext('support.example.com')}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              customDomainEditVersion.current += 1;
              setCustomDomain(event.target.value);
            }}
            onBlur={handleCustomDomainChange}
          />
          {customDomain && !subdomainPublicUrl && (
            <IconTooltip
              icon="delete"
              tip={gettext('Remove')}
              className="mx-0 btn btn-secondary p-0"
              hoverBackground={true}
              size={{ btn: 38, icon: 14 }}
              placement="bottom"
              onClick={onOpenRemoveCustomDomainConfirm}
            />
          )}
        </InputGroup>
      </FormGroup>
      {propsCustomDomain && (
        <>
          <FormGroup className="mb-4">
            <Label className="seaqa-tip-default font-size-12 line-height-20 mb-2">
              {gettext('Add a CNAME record in your DNS hosting provider to make custom domain work. The CNAME record should be as following:')}
            </Label>
            <div className="seaqa-portal-custom-domain-cname-container">
              <Input type="text" value={validCustomDomain} readOnly disabled={true}/>
              <span className="portal-dns-record-type">CNAME</span>
              <InputGroup className="seaqa-project-portal-input-group-settings">
                <Input type="text" value={currentPortalDomain} readOnly disabled={true} />
                <IconTooltip
                  icon="copy"
                  tip={gettext('Copy URL')}
                  disabled={!currentPortalDomain}
                  className="mx-0 btn btn-secondary p-0"
                  hoverBackground={true}
                  size={{ btn: 38, icon: 14 }}
                  placement="bottom"
                  onClick={() => onCopyUrl(currentPortalDomain)}
                />
              </InputGroup>
            </div>
          </FormGroup>
          <FormGroup className="mb-4">
            <Label className="seaqa-tip-default font-size-12 line-height-20 mb-2">
              {gettext('You also need to add a TXT record to verify the ownership of your custom domain.')}
            </Label>
            <FormGroup className="mb-4">
              <Label>
                {gettext('TXT record name')}
              </Label>
              <InputGroup className="seaqa-project-portal-input-group-settings">
                <Input type="text" value={customDomainTxtRecordName} readOnly disabled={true} />
                <IconTooltip
                  icon="copy"
                  tip={gettext('Copy URL')}
                  disabled={!customDomainTxtRecordName}
                  className="mx-0 btn btn-secondary p-0"
                  hoverBackground={true}
                  size={{ btn: 38, icon: 14 }}
                  placement="bottom"
                  onClick={() => onCopyUrl(customDomainTxtRecordName)}
                />
              </InputGroup>
            </FormGroup>
            <FormGroup className="mb-4">
              <Label>
                {gettext('TXT record value')}
              </Label>
              <InputGroup className="seaqa-project-portal-input-group-settings">
                <Input type="text" value={customDomainTxtRecordValue} readOnly disabled={true} />
                <IconTooltip
                  icon="copy"
                  tip={gettext('Copy URL')}
                  disabled={!customDomainTxtRecordValue}
                  className="mx-0 btn btn-secondary p-0"
                  hoverBackground={true}
                  size={{ btn: 38, icon: 14 }}
                  placement="bottom"
                  onClick={() => onCopyUrl(customDomainTxtRecordValue)}
                />
              </InputGroup>
            </FormGroup>
          </FormGroup>
          {customDomainVerified ? (
            <p className="seaqa-tip-default font-size-12 line-height-20 text-success mb-4">
              {gettext('Verified')}
            </p>
          ) : (
            <div className="mb-4">
              <Button
                color="outline-primary"
                size="sm"
                disabled={!canVerifyCustomDomain}
                onClick={onVerifyCustomDomain}
              >
                {isVerifyingCustomDomain ? gettext('Verifying...') : gettext('Verify')}
              </Button>
            </div>
          )}
        </>
      )}
      {isShowRemoveCustomDomainConfirm && (
        <CommonOperationConfirmationDialog
          title={gettext('Remove custom domain')}
          message={gettext('Are you sure you want to remove this custom domain?')}
          confirmBtnText={gettext('Remove')}
          executeOperation={onRemoveCustomDomain}
          toggleDialog={onCloseRemoveCustomDomainConfirm}
        />
      )}
    </SettingsItem>
  );
};

const CustomDomainSettings = () => {
  const { domainAliasSettings, customDomainSettings, updateCustomDomainSettings, verifyCustomDomain } = usePortalSettings();
  const { custom_domain, custom_domain_verified, custom_domain_txt_record_name, custom_domain_txt_record_value, current_subdomain_domain } = customDomainSettings;
  const { subdomain_prefix, public_url } = domainAliasSettings;
  return (
    <Main
      subdomainPublicUrl={public_url}
      subdomainPrefix={subdomain_prefix}
      customDomain={custom_domain}
      customDomainVerified={custom_domain_verified}
      customDomainTxtRecordName={custom_domain_txt_record_name}
      customDomainTxtRecordValue={custom_domain_txt_record_value}
      currentSubdomainDomain={current_subdomain_domain}
      onChange={updateCustomDomainSettings}
      verifyCustomDomain={verifyCustomDomain}
    />
  );
};

export default CustomDomainSettings;
