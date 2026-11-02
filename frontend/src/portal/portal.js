import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/_i18n/i18n-seafile-editor';
import { CenteredLoading } from '@/components';
import { name, username, avatarURL } from '@/constants';
import User from '@/models/user';
import { normalizeHomePageStyle } from '@/portal/main-panel/home/utils';
import SettingPanel from '@/portal/setting-panel';
import { DataProvider } from '@/project/hooks';
import { portalAPI } from './api';
import { PORTAL_PAGE } from './constants';
import LeftBar from './left-bar';
import MainPanel from './main-panel';
import { buildPortalPath, getPortalLoginPath, getPortalPathSegments } from './path-utils';
import TopBar from './top-bar';

import './portal.css';

const {
  projectUuid, isEditMode, projectName, portalName, portalLogo, portalThemeColor: initialPortalThemeColor, isAnonymous, workspaceID, isExternalUser, isPreviewUser, canAccessIssues, canAccessEmails, portalHomeSettings,
} = window.app.pageOptions;

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(PORTAL_PAGE.HOME);
  const [isShowEditPanel, setIsShowEditPanel] = useState(false);
  const [currentPortalName, setCurrentPortalName] = useState(portalName);
  const [currentPortalLogo, setCurrentPortalLogo] = useState(portalLogo);
  const [portalThemeColor, setPortalThemeColor] = useState(initialPortalThemeColor || '#ff8000');
  const [homePageStyle, setHomePageStyle] = useState(() => normalizeHomePageStyle(portalHomeSettings));
  const [activeCard, setActiveCard] = useState('');

  const APIRef = useRef(portalAPI);

  const updateHomeSetting = useCallback((newSetting) => {
    return portalAPI.updateSettings(projectUuid, { 'portal_home_settings': newSetting });
  }, []);

  const user = useMemo(() => new User({ avatar_url: avatarURL, name, email: username }), []);
  const portalThemeStyle = {
    '--bs-sf-orange': portalThemeColor,
    '--bs-sf-orange-light': portalThemeColor,
    '--bs-primary': portalThemeColor,
  };

  const onPageChange = useCallback((page) => {
    const targetPage = !isExternalUser && page === PORTAL_PAGE.TEAM_ISSUES ? PORTAL_PAGE.MY_ISSUES : page;
    const isIssuesPage = [PORTAL_PAGE.SUBMIT_ISSUE, PORTAL_PAGE.MY_ISSUES, PORTAL_PAGE.TEAM_ISSUES].includes(targetPage);
    if (isAnonymous && isIssuesPage) {
      location.href = getPortalLoginPath();
      return;
    }
    if (!canAccessIssues && isIssuesPage) {
      setActivePage(PORTAL_PAGE.HOME);
      history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
      return;
    }
    if (page === PORTAL_PAGE.EMAILS && (!canAccessEmails || isEditMode)) {
      setActivePage(PORTAL_PAGE.HOME);
      history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
      return;
    }
    if (page === PORTAL_PAGE.KNOWLEDGE_BASE) return;
    setActivePage(targetPage);
    history.replaceState(null, null, buildPortalPath(targetPage));
  }, []);

  const onHomeChatSend = useCallback((query) => {
    setActivePage(PORTAL_PAGE.CHAT);
    const chatPath = buildPortalPath(PORTAL_PAGE.CHAT);
    const searchParams = new URLSearchParams({ query });
    history.replaceState(null, null, `${chatPath}?${searchParams.toString()}`);
  }, []);

  const openEditPanel = () => {
    setActivePage(PORTAL_PAGE.HOME);
    setIsShowEditPanel(true);
    setActiveCard('');
    history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
  };

  const closeEditPanel = () => {
    updateHomeSetting(JSON.stringify(homePageStyle));
    setIsShowEditPanel(false);
    setActiveCard('');
  };

  useEffect(() => {
    const pathSegments = getPortalPathSegments();
    if (pathSegments.length > 0) {
      const [pageKey] = pathSegments;
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        const isRestrictedPage = [PORTAL_PAGE.SUBMIT_ISSUE, PORTAL_PAGE.MY_ISSUES, PORTAL_PAGE.TEAM_ISSUES].includes(pageKey);
        if ((isAnonymous || !canAccessIssues) && isRestrictedPage) {
          setActivePage(PORTAL_PAGE.HOME);
        } else if (pageKey === PORTAL_PAGE.EMAILS) {
          if (canAccessEmails) {
            setActivePage(PORTAL_PAGE.EMAILS);
          } else {
            setActivePage(PORTAL_PAGE.HOME);
            history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
          }
        } else if (!isExternalUser && pageKey === PORTAL_PAGE.TEAM_ISSUES) {
          setActivePage(PORTAL_PAGE.MY_ISSUES);
          history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.MY_ISSUES));
        } else if (pageKey === PORTAL_PAGE.KNOWLEDGE_BASE) {
          setActivePage(PORTAL_PAGE.HOME);
        } else {
          setActivePage(pageKey === PORTAL_PAGE.EMAILS ? PORTAL_PAGE.EMAILS : pageKey);
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
      if (!isExternalUser) {
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

  return (
    <I18nextProvider i18n={i18n}>
      <div className={`seaqa-portal${isShowEditPanel ? ' has-settings' : ''}`}>
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
            useNotification={false}
          >
            {isEditMode && <LeftBar isShowEditPanel={isShowEditPanel} openEditPanel={openEditPanel} />}
            <div className="seaqa-portal-body" style={portalThemeStyle}>
              <TopBar
                isEditMode={isEditMode}
                activePage={activePage}
                onPageChange={onPageChange}
                isAnonymous={isAnonymous}
                isExternalUser={isExternalUser}
                canAccessIssues={canAccessIssues}
                canAccessEmails={canAccessEmails}
                portalName={currentPortalName}
                portalLogo={currentPortalLogo}
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
                canAccessIssues={canAccessIssues}
                canAccessEmails={canAccessEmails}
                isExternalUser={isExternalUser}
                portalThemeColor={portalThemeColor}
                updateHomeSetting={updateHomeSetting}
                setIsShowEditPanel={setIsShowEditPanel}
                homePageStyle={homePageStyle}
                setHomePageStyle={setHomePageStyle}
                activeCard={activeCard}
                setActiveCard={setActiveCard}
              />
            </div>
            {isEditMode && isShowEditPanel && (
              <SettingPanel
                homePageStyle={homePageStyle}
                activeCard={activeCard}
                setActiveCard={setActiveCard}
                setHomePageStyle={setHomePageStyle}
                updateHomeSetting={updateHomeSetting}
                portalName={currentPortalName}
                portalLogo={currentPortalLogo}
                portalThemeColor={portalThemeColor}
                setPortalName={setCurrentPortalName}
                setPortalLogo={setCurrentPortalLogo}
                setPortalThemeColor={setPortalThemeColor}
                onClose={closeEditPanel}
                activePage={activePage}
              />
            )}
          </DataProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

export default Portal;
