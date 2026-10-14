import React, { useCallback, useState } from 'react';
import { FormGroup, Label } from 'reactstrap';
import { PasswordInput, SettingsItem, SwitchSettings, toaster } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '../hooks';

import './index.css';

const Main = ({
  allowAnonymous,
  enablePassword,
  onChange,
  ...props
}) => {
  const [password, setPassword] = useState(props?.password || '');
  const [passwordInputVersion, setPasswordInputVersion] = useState(0);
  const [isEnablingPassword, setIsEnablingPassword] = useState(false);

  const isPasswordProtectionEnabled = enablePassword || isEnablingPassword;

  const handleEnablePassword = useCallback((newValue) => {
    if (newValue) {
      setPassword('');
      setIsEnablingPassword(true);
      return;
    }
    setPassword('');
    setIsEnablingPassword(false);
    onChange && onChange({ enable_password_protection: false, password: '' });
  }, [onChange]);

  const handleAllowAnonymousChange = useCallback((newValue) => {
    if (!newValue) {
      setPassword('');
      setIsEnablingPassword(false);
      onChange({
        allow_anonymous: false,
        enable_password_protection: false,
        password: '',
      });
      return;
    }
    onChange({ allow_anonymous: true });
  }, [onChange]);

  const handlePasswordChange = useCallback(() => {
    if (!(allowAnonymous && isPasswordProtectionEnabled)) return;
    if (!password && !isEnablingPassword) return;
    if (!password || password.length < 8) {
      toaster.danger(gettext('Password must be at least 8 characters'), { duration: 2, hasCloseButton: false });
      return;
    }
    onChange({ enable_password_protection: true, password }, (isSuccess = true) => {
      if (isSuccess) {
        setPasswordInputVersion(version => version + 1);
        setIsEnablingPassword(false);
      }
    });
  }, [allowAnonymous, isPasswordProtectionEnabled, isEnablingPassword, password, onChange]);

  return (
    <SettingsItem title={gettext('Open access')} className="seaqa-portal-open-access-settings">
      <SwitchSettings
        value={allowAnonymous}
        onChange={handleAllowAnonymousChange}
        placeholder={gettext('Allow anonymous access')}
        className={allowAnonymous ? '' : 'mb-4'}
      />
      {allowAnonymous && (
        <SwitchSettings
          value={isPasswordProtectionEnabled}
          onChange={handleEnablePassword}
          placeholder={gettext('Enable password protection')}
          className="mb-4"
        />
      )}
      {allowAnonymous && isPasswordProtectionEnabled && (
        <FormGroup className="mb-4">
          <Label>
            {gettext('Password (at least 8 characters)')}
          </Label>
          <PasswordInput
            key={passwordInputVersion}
            value={password}
            onChange={setPassword}
            enableRandomGeneration={false}
            enableCheckStrength={false}
            placeholder={gettext('Enter password')}
            className="seaqa-portal-password-settings"
            onBlur={handlePasswordChange}
          />
        </FormGroup>
      )}
    </SettingsItem>
  );
};

const OpenAccessSettings = () => {
  const { settings, updateSettings } = usePortalSettings();
  const { allow_anonymous, enable_password_protection, password } = settings;
  return (
    <Main
      allowAnonymous={allow_anonymous}
      enablePassword={enable_password_protection}
      password={password}
      onChange={updateSettings}
    />
  );
};

export default OpenAccessSettings;
