import React, { useCallback, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/_i18n/i18n-seafile-editor';
import { gettext } from '@/constants';
import { getPortalAnonymousValidatePath } from './path-utils';

import './password-panel.css';

const PasswordPanel = ({ displayName, csrfToken }) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const onPasswordSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('required');
      return;
    }

    try {
      setIsSubmittingPassword(true);
      setPasswordError('');
      const formData = new FormData();
      formData.append('csrfmiddlewaretoken', csrfToken);
      formData.append('password', passwordInput);

      const response = await fetch(getPortalAnonymousValidatePath(), {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });

      if (response.redirected) {
        if (response.url.includes('/anonymous-validate/')) {
          setPasswordError('invalid');
          return;
        }
        location.href = response.url;
        return;
      }

      if (response.ok) {
        location.reload();
        return;
      }

      setPasswordError('invalid');
    } catch (err) {
      setPasswordError('invalid');
    } finally {
      setIsSubmittingPassword(false);
    }
  }, [csrfToken, passwordInput]);

  const onPasswordChange = useCallback((event) => {
    setPasswordInput(event.target.value);
    if (passwordError && event.target.value.trim()) {
      setPasswordError('');
    }
  }, [passwordError]);

  return (
    <I18nextProvider i18n={i18n}>
      <div className="seaqa-portal">
        <div className="portal-password-panel">
          <div className="portal-password-header">
            <div className="portal-password-title">{displayName}</div>
          </div>
          <form method="post" action={getPortalAnonymousValidatePath()} onSubmit={onPasswordSubmit}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <div className="form-group">
              <label className="portal-password-label">{gettext('Access password')}</label>
              <input
                className="form-control"
                type="password"
                name="password"
                placeholder={gettext('Enter password')}
                autoFocus
                value={passwordInput}
                onChange={onPasswordChange}
              />
            </div>
            {passwordError === 'required' && (
              <div className="portal-password-error">{gettext('Password required')}</div>
            )}
            {passwordError === 'invalid' && (
              <div className="portal-password-error">{gettext('Password invalid')}</div>
            )}
            <div className="portal-password-actions">
              <button className="btn btn-primary" type="submit" disabled={isSubmittingPassword}>
                {isSubmittingPassword ? gettext('Validating...') : gettext('Confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </I18nextProvider>
  );
};

export default PasswordPanel;
