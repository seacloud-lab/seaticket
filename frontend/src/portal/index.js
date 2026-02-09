import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../_i18n/i18n-seafile-editor';
import LeftBar from './left-bar';
import SidePanel from './side-panel';
import MainPanel from './main-panel';
import { CenteredLoading } from '../components';
import { PORTAL_PAGE } from './constants';
import { DataProvider } from '@/project/hooks';
import { portalAPI } from './api';
import { gettext } from '@/constants';

import './index.css';

const { projectUuid, isEditMode, showKBInPortal, needPassword, csrfToken, projectName, isAnonymous } = window.app.pageOptions;

const getDefaultPage = (kbEnabled, anonymous) => {
  if (anonymous) return kbEnabled ? PORTAL_PAGE.KNOWLEDGE_BASE : null;
  if (kbEnabled) return PORTAL_PAGE.KNOWLEDGE_BASE;
  return PORTAL_PAGE.SUBMIT_TICKET;
};

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(getDefaultPage(showKBInPortal, isAnonymous));
  const [enableKB, setEnableKB] = useState(showKBInPortal === true);
  const APIRef = useRef(portalAPI);
  const [needPasswordState] = useState(!!needPassword);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const onPageChange = useCallback((page) => {
    if (isAnonymous && (page === PORTAL_PAGE.SUBMIT_TICKET || page === PORTAL_PAGE.MY_TICKETS)) {
      const { origin } = location;
      location.href = `${origin}/portal/${projectUuid}/login/`;
      return;
    }
    if (!enableKB && page === PORTAL_PAGE.KNOWLEDGE_BASE) return;
    setActivePage(page);
    const { origin } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const url = `${origin}/${basePath}/${projectUuid}/${page}/`;
    history.replaceState(null, null, url);
  }, [enableKB]);

  useEffect(() => {
    const { pathname } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const regex = new RegExp(`/${basePath}/${projectUuid}/([^/]*)`);
    const match = pathname.match(regex);
    if (match && match[1]) {
      const pageKey = match[1];
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        const isTicketPage = pageKey === PORTAL_PAGE.SUBMIT_TICKET || pageKey === PORTAL_PAGE.MY_TICKETS;
        if (isAnonymous && isTicketPage) {
          setActivePage(getDefaultPage(showKBInPortal, isAnonymous));
        } else if (!enableKB && pageKey === PORTAL_PAGE.KNOWLEDGE_BASE) {
          setActivePage(getDefaultPage(showKBInPortal, isAnonymous));
        } else {
          setActivePage(pageKey);
        }
      }
    }

    if (!isEditMode && isAnonymous) {
      APIRef.current.listProjectRelatedUsers = (projectUuid) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: { user_list: [] }
          });
        });
      };
      APIRef.current.listUserInfo = (projectUuid) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: { user_list: [] }
          });
        });
      };
    } else {
      delete APIRef.current['listProjectRelatedUsers'];
      delete APIRef.current['listUserInfo'];
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handler = (e) => setEnableKB(!!(e.detail && e.detail.enabled));
    window.addEventListener('portal:kb-visibility', handler);

    return () => window.removeEventListener('portal:kb-visibility', handler);
  }, []);

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

      const response = await fetch(`/portal/${projectUuid}/anonymous-validate/`, {
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

  const onPasswordChange = useCallback((e) => {
    setPasswordInput(e.target.value);
    if (passwordError && e.target.value.trim()) {
      setPasswordError('');
    }
  }, [passwordError]);


  if (needPasswordState) {
    return (
      <I18nextProvider i18n={i18n}>
        <div className="sea-qa-portal">
          <div className="portal-password-panel">
            <div className="portal-password-header">
              <div className="portal-password-title">{projectName || 'Portal'}</div>
            </div>
            <form method="post" action={`/portal/${projectUuid}/anonymous-validate/`} onSubmit={onPasswordSubmit}>
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
  }
  return (
    <I18nextProvider i18n={i18n}>
      <div className="sea-qa-portal">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <DataProvider projectUuid={projectUuid} api={APIRef.current}>
            {isEditMode && <LeftBar />}
            <SidePanel activePage={activePage} onPageChange={onPageChange} enableKB={enableKB} isAnonymous={isAnonymous} />
            <MainPanel activePage={activePage} projectUuid={projectUuid} onPageChange={onPageChange} />
          </DataProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Portal />);
