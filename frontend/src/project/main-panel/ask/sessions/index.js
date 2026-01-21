import React, { useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { useSessions } from '../hooks';
import { SESSION_TAB_TYPE } from '../constants';
import { EmptyTip, IconButton } from '@/components';
import Session from './session';

import './index.css';

const Sessions = ({ sessionId, permission }) => {
  const {
    sessions,
    teamSessions,
    isTeamSessionsLoading,
    activeTab,
    setActiveTab,
    closeShowSessions,
    loadTeamSessions
  } = useSessions();

  const isTeamTab = activeTab === SESSION_TAB_TYPE.TEAM;
  const displaySessions = isTeamTab ? teamSessions : sessions;

  useEffect(() => {
    if (activeTab === SESSION_TAB_TYPE.TEAM) {
      loadTeamSessions();
    }
  }, [activeTab, loadTeamSessions]);

  return (
    <div className="sea-qa-ai-ask-sessions-wrapper" style={{ width: 300 }}>
      <div className="sea-qa-ai-ask-sessions-header">
        <div>{gettext('Histories')}</div>
        <IconButton icon="close" onClick={closeShowSessions} title={gettext('Close')} aria-label={gettext('Close')} />
      </div>
      <div className="sea-qa-ai-ask-sessions-tabs">
        <span
          className={classnames('sea-qa-ai-ask-sessions-tab', { 'active': activeTab === SESSION_TAB_TYPE.MINE })}
          onClick={() => setActiveTab(SESSION_TAB_TYPE.MINE)}
        >
          {gettext('Mine')}
        </span>
        <span
          className={classnames('sea-qa-ai-ask-sessions-tab', { 'active': activeTab === SESSION_TAB_TYPE.TEAM })}
          onClick={() => setActiveTab(SESSION_TAB_TYPE.TEAM)}
        >
          {gettext('Team')}
        </span>
      </div>
      <div className="sea-qa-ai-ask-sessions-body">
        {isTeamTab && isTeamSessionsLoading && (
          <div className="sea-qa-ai-ask-sessions-loading">{gettext('Loading...')}</div>
        )}
        {!isTeamSessionsLoading && displaySessions.length === 0 && (
          <EmptyTip text={gettext('No chats')} />
        )}
        {!isTeamSessionsLoading && displaySessions.map(session => {
          const isSelected = sessionId === session._id;
          return (
            <Session
              key={session._id}
              session={session}
              permission={permission}
              isSelected={isSelected}
              isTeamTab={isTeamTab}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Sessions;
