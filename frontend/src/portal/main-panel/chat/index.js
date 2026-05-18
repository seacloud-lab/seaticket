import React, { useCallback, useEffect, useMemo } from 'react';
import { CenteredLoading, IconButton } from '@/components';
import Sessions from '@/project/main-panel/ask/sessions';
import Chat from '@/project/main-panel/ask/chat';
import { AskPageProvider, SessionsProvider, DocumentsProvider, useAskPage, useSessions } from '@/project/main-panel/ask/hooks';
import { gettext, siteRoot } from '@/constants';
import { ASK_PAGE_SLUG_ID } from '@/project/main-panel/ask/constants';
import Documents from '@/project/main-panel/ask/documents';
import { chatAPI } from '@/portal/api/chat-api';

import '@/project/main-panel/ask/index.css';

const {
  projectUuid, projectName, workspaceID, isEditMode, streamingResponse
} = window.app.pageOptions;

const Main = ({ title, settings }) => {
  const { isLoading: isAskPageLoading, pageSlugId, togglePageSlugId } = useAskPage();
  const { isLoading: isSessionsLoading, isShowSessions, toggleIsShowSessions, sessions } = useSessions();

  const permission = 'rw';

  const isLoading = isAskPageLoading || isSessionsLoading;

  useEffect(() => {
    if (isLoading) return;
    if (pageSlugId === ASK_PAGE_SLUG_ID.NEW) return;
    const hasSession = sessions.some(session => session._id === pageSlugId);
    if (!hasSession) {
      togglePageSlugId(ASK_PAGE_SLUG_ID.NEW);
    }
  }, [isLoading, pageSlugId, sessions, togglePageSlugId]);

  return (
    <>
      <div className="ask-main-container">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <>
            <div className="d-flex o-hidden flex-1">
              <Chat
                sessionId={pageSlugId}
                workspaceID={workspaceID}
                projectUuid={projectUuid}
                projectName={projectName}
                settings={settings}
                api={chatAPI}
                canAddDocuments={false}
                canSelectModel={false}
                customHeaderTitle={gettext('Chat')}
                renderOperation={() => (
                  <div className="d-flex">
                    <IconButton
                      icon="new-chat"
                      onClick={() => togglePageSlugId(ASK_PAGE_SLUG_ID.NEW)}
                      className="mr-2"
                      title={gettext('New chat')}
                      aria-label={gettext('New chat')}
                    />
                    <IconButton
                      icon="history"
                      onClick={toggleIsShowSessions}
                      title={gettext('Histories')}
                      aria-label={gettext('Histories')}
                    />
                  </div>
                )}
              />
              <Documents />
            </div>
            {isShowSessions && (<Sessions sessionId={pageSlugId} permission={permission} />)}
          </>
        )}
      </div>
    </>
  );
};

const Ask = ({ title = gettext('Chat') }) => {
  const settings = useMemo(() => {
    return {
      streaming_response: streamingResponse,
    };
  }, []);

  const resetURL = useCallback((pageSlugId) => {
    const { origin } = location;
    let url = `${origin}${siteRoot}${isEditMode ? 'portal-edit' : 'portal'}/${projectUuid}/chat/`;
    let urlPart = pageSlugId === ASK_PAGE_SLUG_ID.NEW ? '' : pageSlugId + '/';
    history.replaceState(null, null, url + urlPart);
  }, [workspaceID]);

  const getInitialPageSlugId = useCallback(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const part = `/${isEditMode ? 'portal-edit' : 'portal'}/${projectUuid}/`;
    const projectNameIndex = decodePathname.indexOf(part);
    const paramsString = decodePathname.slice(projectNameIndex + part.length);
    const params = paramsString.split('/');
    const [, pageIdFromURL = ''] = params;
    return pageIdFromURL || ASK_PAGE_SLUG_ID.NEW;
  }, []);

  return (
    <AskPageProvider resetURL={resetURL} getInitialPageSlugId={getInitialPageSlugId} >
      <SessionsProvider
        projectUuid={projectUuid}
        localStorageKey={`seaqa-${projectUuid}-portal-chat-sessions-display`}
        api={chatAPI}
      >
        <DocumentsProvider>
          <Main title={title} settings={settings} />
        </DocumentsProvider>
      </SessionsProvider>
    </AskPageProvider>
  );
};

export default Ask;
