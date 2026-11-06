import React, { useCallback, useState } from 'react';
import { FormGroup, Label } from 'reactstrap';
import { PasswordInput, SettingsItem, SwitchSettings, SaveStatus } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '../hooks';
import { getInputCheckError } from '../utils';

import './index.css';

const Main = ({
  allowAnonymous,
  enablePassword,
  savedPassword,
  onChange,
}) => {
  const [password, setPassword] = useState(savedPassword || '');
  const [isPasswordDirty, setIsPasswordDirty] = useState(false);
  const [passwordInputVersion, setPasswordInputVersion] = useState(0);
  const [isEnablingPassword, setIsEnablingPassword] = useState(false);

  const isPasswordProtectionEnabled = enablePassword || isEnablingPassword;

  const handleAllowAnonymousChange = useCallback((newValue, callback) => {
    const previousPassword = password;
    const previousPasswordDirty = isPasswordDirty;
    const previousIsEnablingPassword = isEnablingPassword;
    let update = { allow_anonymous: Boolean(newValue) };
    if (!newValue) {
      setPassword('');
      setIsPasswordDirty(false);
      setIsEnablingPassword(false);
      update['enable_password_protection'] = false;
      update['password'] = '';
    }
    onChange(update, (callbackParams = {}) => {
      callback && callback(callbackParams);
      if (callbackParams.error && !newValue) {
        setPassword(previousPassword);
        setIsPasswordDirty(previousPasswordDirty);
        setIsEnablingPassword(previousIsEnablingPassword);
      }
    });
  }, [onChange, password, isPasswordDirty, isEnablingPassword]);

  const handleEnablePassword = useCallback((newValue, callback) => {
    const previousPassword = password;
    const previousPasswordDirty = isPasswordDirty;
    if (!newValue) {
      setPassword('');
      setIsPasswordDirty(false);
    }
    setIsEnablingPassword(Boolean(newValue));
    if (newValue || enablePassword === newValue) {
      callback && callback({}, true);
      return;
    }

    onChange && onChange({ enable_password_protection: false, password: '' }, (callbackParams = {}) => {
      callback && callback(callbackParams);
      if (callbackParams.error) {
        setPassword(previousPassword);
        setIsPasswordDirty(previousPasswordDirty);
      }
    });
  }, [enablePassword, onChange, password, isPasswordDirty]);

  const handlePasswordChange = useCallback((callback) => {
    if (!password || password.length < 8) {
      callback && callback({
        error: getInputCheckError(gettext('Password must be at least 8 characters')),
      });
      return;
    }
    onChange({ enable_password_protection: true, password }, (callbackParams) => {
      callback && callback(callbackParams);
      if (callbackParams?.error) return;
      setIsPasswordDirty(false);
      setPasswordInputVersion(version => version + 1);
      setIsEnablingPassword(false);
    });
  }, [password, onChange]);

  return (
    <SettingsItem title={gettext('Open access')} className="seaqa-portal-open-access-settings">
      <SaveStatus
        className={allowAnonymous ? '' : 'mb-4'}
        callback={(callback, update) => handleAllowAnonymousChange(update, callback)}
      >
        {({ callback, onContentChange }) => (
          <SwitchSettings
            value={allowAnonymous}
            isFullWidth={false}
            onChange={(value) => {
              onContentChange();
              callback(value);
            }}
            placeholder={gettext('Allow anonymous access')}
          />
        )}
      </SaveStatus>
      {allowAnonymous && (
        <SaveStatus className="mb-4" callback={(callback, update) => handleEnablePassword(update, callback)}>
          {({ callback, onContentChange }) => (
            <SwitchSettings
              value={isPasswordProtectionEnabled}
              isFullWidth={false}
              onChange={(value) => {
                onContentChange();
                callback(value);
              }}
              placeholder={gettext('Enable password protection')}
            />
          )}
        </SaveStatus>
      )}
      {allowAnonymous && isPasswordProtectionEnabled && (
        <FormGroup className="mb-4 flex-fill">
          <Label>
            {gettext('Password (at least 8 characters)')}
          </Label>
          <SaveStatus className="w-100" type="input" callback={handlePasswordChange}>
            {({ callback, onContentChange }) => (
              <PasswordInput
                key={passwordInputVersion}
                value={password}
                onChange={(value) => {
                  onContentChange();
                  setIsPasswordDirty(true);
                  setPassword(value);
                }}
                enableRandomGeneration={false}
                enableCheckStrength={false}
                placeholder={gettext('Enter password')}
                className="seaqa-portal-password-settings"
                onBlur={isPasswordDirty || isEnablingPassword ? callback : undefined}
              />
            )}
          </SaveStatus>
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
      savedPassword={password}
      onChange={updateSettings}
    />
  );
};

export default OpenAccessSettings;
