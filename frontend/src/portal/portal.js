import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/_i18n/i18n-seafile-editor';
import { CenteredLoading } from '@/components';
import { name, username, avatarURL } from '@/constants';
import User from '@/models/user';
import { DataProvider } from '@/project/hooks';
import { portalAPI } from './api';
import { PORTAL_PAGE } from './constants';
import LeftBar from './left-bar';
import MainPanel from './main-panel';
import { buildPortalPath, getPortalLoginPath, getPortalPathSegments } from './path-utils';
import TopBar from './top-bar';

import './portal.css';

const {
  projectUuid, isEditMode, projectName, isAnonymous, workspaceID, isExternalUser, isPreviewUser, canAccessIssues,
} = window.app.pageOptions;

const Portal = () => {
  const [isLoading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(PORTAL_PAGE.HOME);
  const [isShowEditPanel, setIsShowEditPanel] = useState(false);
  const APIRef = useRef(portalAPI);

  const user = useMemo(() => new User({ avatar_url: avatarURL, name, email: username }), []);

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
    history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.HOME));
  };

  useEffect(() => {
    const pathSegments = getPortalPathSegments();
    if (pathSegments.length > 0) {
      const [pageKey] = pathSegments;
      if (Object.values(PORTAL_PAGE).includes(pageKey)) {
        const isRestrictedPage = [PORTAL_PAGE.SUBMIT_ISSUE, PORTAL_PAGE.MY_ISSUES, PORTAL_PAGE.TEAM_ISSUES].includes(pageKey);
        if ((isAnonymous || !canAccessIssues) && isRestrictedPage) {
          setActivePage(PORTAL_PAGE.HOME);
        } else if (!isExternalUser && pageKey === PORTAL_PAGE.TEAM_ISSUES) {
          setActivePage(PORTAL_PAGE.MY_ISSUES);
          history.replaceState(null, null, buildPortalPath(PORTAL_PAGE.MY_ISSUES));
        } else if (pageKey === PORTAL_PAGE.KNOWLEDGE_BASE) {
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

  useEffect(() => {
    if (activePage !== PORTAL_PAGE.HOME) setIsShowEditPanel(false);
  }, [activePage]);

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
            useNotification={false}
          >
            {isEditMode && <LeftBar isShowEditPanel={isShowEditPanel} openEditPanel={openEditPanel} />}
            <div className="seaqa-portal-body">
              <TopBar
                isEditMode={isEditMode}
                activePage={activePage}
                onPageChange={onPageChange}
                isAnonymous={isAnonymous}
                isExternalUser={isExternalUser}
                canAccessIssues={canAccessIssues}
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
                isExternalUser={isExternalUser}
                isShowEditPanel={isShowEditPanel}
                setIsShowEditPanel={setIsShowEditPanel}
              />
            </div>
          </DataProvider>
        )}
      </div>
    </I18nextProvider>
  );
};

export default Portal;
