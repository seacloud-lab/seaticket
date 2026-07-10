import React, { useCallback, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import { CenteredLoading, IconButton } from '@/components';
import Sessions from '@/project/main-panel/ask/sessions';
import Chat from '@/project/main-panel/ask/chat';
import { AskPageProvider, SessionsProvider, DocumentsProvider, useAskPage, useSessions } from '@/project/main-panel/ask/hooks';
import { gettext } from '@/constants';
import { ASK_PAGE_SLUG_ID } from '@/project/main-panel/ask/constants';
import Documents from '@/project/main-panel/ask/documents';
import { chatAPI } from '@/portal/api/chat-api';
import { isMobile } from '@/utils/utils';
import { buildPortalPath, getPortalPathSegments } from '@/portal/path-utils';

import '@/project/main-panel/ask/index.css';

const {
  projectUuid, projectName, workspaceID, streamingResponse, isEditMode
} = window.app.pageOptions;

const Main = ({ title, settings, isEditMode }) => {
  const { isLoading: isAskPageLoading, pageSlugId, togglePageSlugId } = useAskPage();
  const { isLoading: isSessionsLoading, isShowSessions, toggleIsShowSessions, closeShowSessions, sessions } = useSessions();

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
                allowedAttachmentSources={['image']}
                canSelectModel={false}
                enableSkills={false}
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
            {isMobile && isShowSessions && (
              <div
                className={classnames('modal-backdrop fade show seaqa-portal-chat-sessions-backdrop', { 'edit-mode': isEditMode })}
                onClick={closeShowSessions}
              />
            )}
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
    history.replaceState(
      null,
      null,
      pageSlugId === ASK_PAGE_SLUG_ID.NEW ? buildPortalPath('chat') : buildPortalPath('chat', pageSlugId),
    );
  }, []);

  const getInitialPageSlugId = useCallback(() => {
    const [, pageIdFromURL = ''] = getPortalPathSegments();
    return pageIdFromURL || ASK_PAGE_SLUG_ID.NEW;
  }, []);

  return (
    <AskPageProvider resetURL={resetURL} getInitialPageSlugId={getInitialPageSlugId} >
      <SessionsProvider projectUuid={projectUuid} api={chatAPI}>
        <DocumentsProvider>
          <Main title={title} settings={settings} isEditMode={isEditMode} />
        </DocumentsProvider>
      </SessionsProvider>
    </AskPageProvider>
  );
};

export default Ask;
