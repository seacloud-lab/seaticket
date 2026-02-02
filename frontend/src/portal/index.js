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

const { projectUuid, isEditMode, showKBInPortal, needPassword, csrfToken, projectName } = window.app.pageOptions;

const getDefaultPage = (kbEnabled) => {
  if (kbEnabled) return PORTAL_PAGE.KNOWLEDGE_BASE;
  return PORTAL_PAGE.SUBMIT_TICKET;
};

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(getDefaultPage(showKBInPortal));
  const [enableKB, setEnableKB] = useState(showKBInPortal === true);
  const APIRef = useRef(portalAPI);
  const [needPasswordState] = useState(!!needPassword);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const onPageChange = useCallback((page) => {
    if (!enableKB && page === PORTAL_PAGE.KNOWLEDGE_BASE) return;
    setActivePage(page);
    const { origin } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const url = `${origin}/${basePath}/${projectUuid}/${page}/`;
    history.replaceState(null, null, url);
  }, []);

  useEffect(() => {
    const { pathname } = location;
    const basePath = isEditMode ? 'portal-edit' : 'portal';
    const regex = new RegExp(`/${basePath}/${projectUuid}/([^/]*)`);
    const match = pathname.match(regex);
    if (match && match[1]) {
      const pageKey = match[1];
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        if (!enableKB && pageKey === PORTAL_PAGE.KNOWLEDGE_BASE) {
          setActivePage(getDefaultPage(showKBInPortal));
        } else {
          setActivePage(pageKey);
        }
      }
    }

    if (!isEditMode) {
      APIRef.current.listProjectRelatedUsers = (projectUuid) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: { user_list: [] }
          });
        });
      };
    } else {
      delete APIRef.current['listProjectRelatedUsers'];
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handler = (e) => setEnableKB(!!(e.detail && e.detail.enabled));
    window.addEventListener('portal:kb-visibility', handler);

    return () => window.removeEventListener('portal:kb-visibility', handler);
  }, []);

  const onPasswordSubmit = useCallback((event) => {
    if (!passwordInput.trim()) {
      event.preventDefault();
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
  }, [passwordInput]);

  const onPasswordChange = useCallback((e) => {
    setPasswordInput(e.target.value);
    if (passwordError && e.target.value.trim()) {
      setPasswordError(false);
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
              {passwordError && (
                <div className="portal-password-error">{gettext('Password required')}</div>
              )}
              <div className="portal-password-actions">
                <button className="btn btn-primary" type="submit">{gettext('Confirm')}</button>
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
            <SidePanel activePage={activePage} onPageChange={onPageChange} enableKB={enableKB} />
            <MainPanel activePage={activePage} projectUuid={projectUuid} onPageChange={onPageChange} />
          </DataProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(<Portal />);
