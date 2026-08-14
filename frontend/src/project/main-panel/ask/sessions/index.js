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

const Sessions = ({ sessionId, permission, onLoadMore }) => {
  const {
    sessions,
    teamSessions,
    isTeamSessionsLoading,
    activeTab,
    setActiveTab,
    closeShowSessions,
    loadTeamSessions,
    isLoadingMore,
    hasMoreSessions,
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
      loadTeamSessions && loadTeamSessions();
    }
  }, [activeTab, loadTeamSessions]);

  const handleScroll = (event) => {
    if (!onLoadMore || isLoadingMore || !hasMoreSessions) return;
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80) onLoadMore();
  };

  return (
    <div className="seaqa-ai-ask-sessions-wrapper" style={{ width: 280, marginLeft: _isShowDocuments ? 16 : 0 }}>
      <div className="seaqa-ai-ask-sessions-header">
        <div>{gettext('Histories')}</div>
        <IconButton icon="close" onClick={closeShowSessions} title={gettext('Close')} aria-label={gettext('Close')} />
      </div>
      {loadTeamSessions && (
        <CustomizeTabs
          className="seaqa-ai-ask-sessions-tabs"
          value={activeTab}
          tabs={TABS}
          onChange={setActiveTab}
        />
      )}
      <div className="seaqa-ai-ask-sessions-body" onScroll={handleScroll}>
        {isTeamTab && isTeamSessionsLoading && (
          <CenteredLoading />
        )}
        {!isTeamSessionsLoading && displaySessions.length === 0 && (
          <EmptyTip src={`${mediaUrl}img/no-notification.png`} className="seaqa-ai-ask-sessions-empty" text={gettext('No chats')} />
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
        {isLoadingMore && <CenteredLoading />}
      </div>
    </div>
  );
};

export default Sessions;
