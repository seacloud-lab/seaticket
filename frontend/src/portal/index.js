import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import { gettext, name, username, avatarURL, mediaUrl } from '@/constants';
import User from '@/models/user';
import { PortalSettingsProvider } from './hooks';
import {
  buildPortalPath,
  getPortalAnonymousValidatePath,
  getPortalLoginPath,
  getPortalPathSegments,
} from './path-utils';

import './index.css';

const {
  projectUuid, isEditMode, showKBInPortal, needPassword, csrfToken, projectName,
  isAnonymous, workspaceID, isExternalUser, isPreviewUser, portalName, portalLogo,
} = window.app.pageOptions;

const initSettings = {
  name: portalName || gettext('Support portal'),
  logo: portalLogo || `${mediaUrl}img/portal-logo.png`,
};

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(PORTAL_PAGE.HOME);
  const [enableKB, setEnableKB] = useState(showKBInPortal === true);
  const APIRef = useRef(portalAPI);
  const [needPasswordState] = useState(!!needPassword);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const user = useMemo(() => new User({ avatar_url: avatarURL, name, email: username }), []);

  const onPageChange = useCallback((page) => {
    if (isAnonymous && (page === PORTAL_PAGE.SUBMIT_ISSUE || page === PORTAL_PAGE.MY_ISSUES)) {
      location.href = getPortalLoginPath();
      return;
    }
    if (!enableKB && page === PORTAL_PAGE.KNOWLEDGE_BASE) return;
    setActivePage(page);
    history.replaceState(null, null, buildPortalPath(page));
  }, [enableKB]);

  const onHomeChatSend = useCallback((query) => {
    setActivePage(PORTAL_PAGE.CHAT);
    const chatPath = buildPortalPath(PORTAL_PAGE.CHAT);
    const searchParams = new URLSearchParams({ query });
    history.replaceState(null, null, `${chatPath}?${searchParams.toString()}`);
  }, []);

  useEffect(() => {
    const pathSegments = getPortalPathSegments();
    if (pathSegments.length > 0) {
      const [pageKey] = pathSegments;
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        const isRestrictedPage = pageKey === PORTAL_PAGE.SUBMIT_ISSUE || pageKey === PORTAL_PAGE.MY_ISSUES;
        if (isAnonymous && isRestrictedPage) {
          setActivePage(PORTAL_PAGE.HOME);
        } else if (!enableKB && pageKey === PORTAL_PAGE.KNOWLEDGE_BASE) {
          setActivePage(PORTAL_PAGE.HOME);
        } else {
          setActivePage(pageKey);
        }
      } else {
        setActivePage(PORTAL_PAGE.HOME);
      }
    } else {
      history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
    }

    if (!isEditMode && (isAnonymous || isExternalUser || isPreviewUser)) {
      APIRef.current.listProjectRelatedUsers = (projectUuid) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: { user_list: [user] }
          });
        });
      };
      if (!isExternalUser){
        APIRef.current.listUserInfo = (userIdList) => {
          return new Promise((resolve, reject) => {
            resolve({
              data: { user_list: [user] }
            });
          });
        };
      }
    } else {
      delete APIRef.current['listProjectRelatedUsers'];
      delete APIRef.current['listUserInfo'];
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [passwordInput]);

  const onPasswordChange = useCallback((e) => {
    setPasswordInput(e.target.value);
    if (passwordError && e.target.value.trim()) {
      setPasswordError('');
    }
  }, [passwordError]);


  if (needPasswordState) {
    const displayName = portalName || projectName;
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
  }
  return (
    <I18nextProvider i18n={i18n}>
      <div className="seaqa-portal">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <DataProvider
            projectUuid={projectUuid}
            api={APIRef.current}
            projectName={projectName}
            workspaceID={workspaceID}
            enablePortal={true}
            isSubscribeConnectionsSyncStatus={false}
          >
            {isEditMode && <LeftBar />}
            <div className="seaqa-portal-body">
              <SidePanel
                isEditMode={isEditMode}
                activePage={activePage}
                onPageChange={onPageChange}
                enableKB={enableKB}
                isAnonymous={isAnonymous}
                isExternalUser={isExternalUser}
              />
              <MainPanel
                isEditMode={isEditMode}
                activePage={activePage}
                projectUuid={projectUuid}
                projectName={projectName}
                workspaceID={workspaceID}
                isAnonymous={isAnonymous}
                onPageChange={onPageChange}
                onHomeChatSend={onHomeChatSend}
              />
            </div>
          </DataProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <PortalSettingsProvider projectUuid={projectUuid} { ...initSettings }>
    <Portal />
  </PortalSettingsProvider>
);
