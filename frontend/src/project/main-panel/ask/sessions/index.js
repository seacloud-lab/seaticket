import React, { useEffect, useMemo } from 'react';
import { gettext, mediaUrl } from '@/constants';
import { useSessions, useDocuments } from '../hooks';
import { SESSION_TAB_TYPE } from '../constants';
import { EmptyTip, IconButton, CustomizeTabs, CenteredLoading } from '@/components';
import Session from './session';

import './index.css';

const TABS = [
  { value: SESSION_TAB_TYPE.MINE, label: gettext('Mine') },
  { value: SESSION_TAB_TYPE.TEAM, label: gettext('Team') },
];

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
  const { isShowDocuments, documents } = useDocuments();

  const _isShowDocuments = useMemo(() => {
    if (!isShowDocuments) return false;
    if (!Array.isArray(documents) || documents.length === 0) return false;
    return true;
  }, [isShowDocuments, documents]);

  const isTeamTab = activeTab === SESSION_TAB_TYPE.TEAM;
  const displaySessions = isTeamTab ? teamSessions : sessions;

  useEffect(() => {
    if (activeTab === SESSION_TAB_TYPE.TEAM) {
      loadTeamSessions();
    }
  }, [activeTab, loadTeamSessions]);

  return (
    <div className="sea-qa-ai-ask-sessions-wrapper" style={{ width: 280, marginLeft: _isShowDocuments ? 16 : 0 }}>
      <div className="sea-qa-ai-ask-sessions-header">
        <div>{gettext('Histories')}</div>
        <IconButton icon="close" onClick={closeShowSessions} title={gettext('Close')} aria-label={gettext('Close')} />
      </div>
      <CustomizeTabs
        className="sea-qa-ai-ask-sessions-tabs"
        value={activeTab}
        tabs={TABS}
        onChange={setActiveTab}
      />
      <div className="sea-qa-ai-ask-sessions-body">
        {isTeamTab && isTeamSessionsLoading && (
          <CenteredLoading />
        )}
        {!isTeamSessionsLoading && displaySessions.length === 0 && (
          <EmptyTip src={`${mediaUrl}img/no-nitification.png`} className="sea-qa-ai-ask-sessions-empty" text={gettext('No chats')} />
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
