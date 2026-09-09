import React, { useEffect, useCallback, useState } from 'react';
import { CenteredLoading, IconButton } from '@/components';
import { PERMISSION_TYPES, gettext, siteRoot } from '@/constants';
import { chatAPI, skillsAPI } from '@/project/api';
import { BAR_TYPE } from '../../constants';
import { useConnections } from '../connections/hooks';
import TopBar from '../top-bar';
import Chat from './chat';
import { ASK_PAGE_SLUG_ID } from './constants';
import Documents from './documents';
import { AskPageProvider, SessionsProvider, DocumentsProvider, useAskPage, useSessions } from './hooks';
import Sessions from './sessions';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Main = ({ title, settings }) => {
  const { isLoading: isAskPageLoading, pageSlugId, togglePageSlugId } = useAskPage();
  const { isLoading: isSessionsLoading, isShowSessions, toggleIsShowSessions, closeShowSessions } = useSessions();
  const [skillCommands, setSkillCommands] = useState([]);

  const isLoading = isAskPageLoading || isSessionsLoading;

  useEffect(() => {
    skillsAPI.listSkillCommands(projectUuid).then((res) => {
      const commands = Array.isArray(res?.data?.commands) ? res.data.commands : [];
      setSkillCommands(commands.filter(name => typeof name === 'string' && name));
    }).catch(() => {
      // Do not block chat if skills endpoint fails.
      setSkillCommands([]);
    });
  }, []);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
        {!isLoading && (
          <div className="d-flex">
            {permission === PERMISSION_TYPES.READ_WRITE && (
              <IconButton
                icon="new-chat"
                onClick={() => togglePageSlugId(ASK_PAGE_SLUG_ID.NEW)}
                className="mr-2"
                title={gettext('New chat')}
                aria-label={gettext('New chat')}
              />
            )}
            <IconButton
              icon="history"
              onClick={toggleIsShowSessions}
              title={gettext('Histories')}
              aria-label={gettext('Histories')}
            />
          </div>
        )}
      </TopBar>
      <div className="ask-main-container">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <DocumentsProvider sessionId={pageSlugId} openDocumentCallback={closeShowSessions}>
            <div className="d-flex o-hidden flex-1">
              <Chat
                sessionId={pageSlugId}
                workspaceID={workspaceID}
                projectUuid={projectUuid}
                projectName={projectName}
                settings={settings}
                skillCommands={skillCommands}
                api={chatAPI}
              />
              <Documents />
            </div>
            {isShowSessions && (<Sessions sessionId={pageSlugId} permission={permission} />)}
          </DocumentsProvider>
        )}
      </div>
    </>
  );
};

const Ask = ({ title, settings }) => {
  const { reloadConnections } = useConnections();

  const resetURL = useCallback((pageSlugId) => {
    const { origin } = location;
    let url = `${origin}${siteRoot}workspace/${workspaceID}/project/${projectName}/${BAR_TYPE.CHAT}/`;
    let urlPart = pageSlugId === ASK_PAGE_SLUG_ID.NEW ? '' : pageSlugId + '/';
    history.replaceState(null, null, url + urlPart);
  }, []);

  const getInitialPageSlugId = useCallback(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/project/${projectName}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = ''] = params;
    return pageIdFromURL || ASK_PAGE_SLUG_ID.NEW;
  }, []);

  useEffect(() => {
    reloadConnections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AskPageProvider resetURL={resetURL} getInitialPageSlugId={getInitialPageSlugId} >
      <SessionsProvider projectUuid={projectUuid} api={chatAPI} >
        <Main title={title} settings={settings} />
      </SessionsProvider>
    </AskPageProvider>
  );
};

export default Ask;
