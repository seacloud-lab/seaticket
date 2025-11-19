import React from 'react';
import { CenteredLoading, IconButton } from '@/components';
import TopBar from '../top-bar';
import Sessions from './sessions';
import Chat from './chat';
import { AskPageProvider, SessionsProvider, useAskPage, useSessions } from './hooks';
import { PERMISSION_TYPES } from '@/constants';
import { ASK_PAGE_SLUG_ID } from './constants';

import './index.css';

const {
  projectUuid, projectName, workspaceID, permission
} = window.app.pageOptions;

const Main = ({ title, settings }) => {
  const { isLoading: isAskPageLoading, pageSlugId, togglePageSlugId } = useAskPage();
  const { isLoading: isSessionsLoading, isShowSessions, toggleIsShowSessions } = useSessions();

  const isLoading = isAskPageLoading || isSessionsLoading;

  return (
    <>
      <TopBar className="pr-3">
        <div className="w-100 text-truncate">{title}</div>
        {!isLoading && (
          <div className="d-flex">
            {permission === PERMISSION_TYPES.READ_WRITE && (
              <IconButton icon="new-chat" onClick={() => togglePageSlugId(ASK_PAGE_SLUG_ID.NEW)} style={{ marginRight: '10px' }} />
            )}
            <IconButton icon="history" onClick={toggleIsShowSessions} />
          </div>
        )}
      </TopBar>
      <div className="ask-main-container">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <>
            <Chat
              sessionId={pageSlugId}
              isShowSessions={isShowSessions}
              workspaceID={workspaceID}
              projectUuid={projectUuid}
              projectName={projectName}
              settings={settings}
            />
            {isShowSessions && (<Sessions sessionId={pageSlugId} permission={permission} />)}
          </>
        )}
      </div>
    </>
  );
};

const Ask = ({ title, settings }) => {
  return (
    <AskPageProvider workspaceID={workspaceID} projectName={projectName} >
      <SessionsProvider workspaceID={workspaceID} projectUuid={projectUuid} >
        <Main title={title} settings={settings} />
      </SessionsProvider>
    </AskPageProvider>
  );
};

export default Ask;
