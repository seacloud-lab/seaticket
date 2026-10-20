import React, { useCallback, useState } from 'react';
import { FormGroup, Label } from 'reactstrap';
import { PasswordInput, SettingsItem, SwitchSettings, SaveStatus } from '@/components';
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

  const handleEnablePassword = useCallback((newValue, callback) => {
    if (newValue) {
      setPassword('');
      setIsEnablingPassword(true);
      callback && callback();
      return;
    }
    setPassword('');
    setIsEnablingPassword(false);
    if (enablePassword === newValue) {
      callback && callback();
      return;
    }
    onChange && onChange({ enable_password_protection: false, password: '' }, callback);
  }, [enablePassword, onChange]);

  const handleAllowAnonymousChange = useCallback((newValue, callback) => {
    if (!newValue) {
      setPassword('');
      setIsEnablingPassword(false);
      onChange({
        allow_anonymous: false,
        enable_password_protection: false,
        password: '',
      }, callback);
      return;
    }
    onChange({ allow_anonymous: true }, callback);
  }, [onChange]);

  const handlePasswordChange = useCallback((callback) => {
    if (!password && !isEnablingPassword) {
      callback && callback(false, gettext('Password is invalid'));
      return;
    }
    if (!password || password.length < 8) {
      callback && callback(false, gettext('Password must be at least 8 characters'));
      return;
    }
    onChange({ enable_password_protection: true, password }, (isSuccess = true, errorMessage) => {
      callback && callback(isSuccess, errorMessage);
      if (isSuccess) {
        setPasswordInputVersion(version => version + 1);
        setIsEnablingPassword(false);
        return;
      }
      setPassword('');
      setPasswordInputVersion(version => version + 1);
      setIsEnablingPassword(false);
    });
  }, [isEnablingPassword, password, onChange]);

  return (
    <SettingsItem title={gettext('Open access')} className="seaqa-portal-open-access-settings">
      <SaveStatus className={allowAnonymous ? '' : 'mb-4'} callback={(callback, update) => handleAllowAnonymousChange(update, callback)}>
        {({ callback }) => (
          <SwitchSettings
            value={allowAnonymous}
            onChange={callback}
            placeholder={gettext('Allow anonymous access')}
          />
        )}
      </SaveStatus>
      {allowAnonymous && (
        <SaveStatus className="mb-4" callback={(callback, update) => handleEnablePassword(update, callback)}>
          {({ callback }) => (
            <SwitchSettings
              value={isPasswordProtectionEnabled}
              onChange={callback}
              placeholder={gettext('Enable password protection')}
            />
          )}
        </SaveStatus>
      )}
      {allowAnonymous && (
        <SaveStatus className="w-100" callback={handlePasswordChange}>
          {({ callback }) => isPasswordProtectionEnabled && (
            <FormGroup className="mb-4 flex-fill">
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
                onBlur={password === props?.password ? undefined : callback}
              />
            </FormGroup>
          )}
        </SaveStatus>
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
