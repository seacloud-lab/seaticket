import React from 'react';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { useAskPage, useSessions } from '../hooks';
import { Button } from 'reactstrap';
import { EmptyTip, Icon, IconButton } from '@/components';
import { ASK_PAGE_TYPE } from '../constants';
import Session from './session';

import './index.css';

const Sessions = ({ sessionId, permission }) => {
  const { sessions, closeShowSessions } = useSessions();
  const { togglePageType } = useAskPage();

  return (
    <div className="sea-qa-ai-ask-sessions-wrapper" style={{ width: 300 }}>
      <div className="sea-qa-ai-ask-sessions-header">
        <div>{gettext('Histories')}</div>
        <IconButton icon="x" onClick={closeShowSessions} />
      </div>
      <div className="sea-qa-ai-ask-sessions-body">
        {sessions.length === 0 && (
          <EmptyTip text={gettext('No chats')} />
        )}
        {sessions.map(session => {
          const isSelected = sessionId === session.session_uuid;
          return (
            <Session key={session.session_uuid} session={session} permission={permission} isSelected={isSelected} />
          );
        })}
      </div>
      {permission === PERMISSION_TYPES.READ_WRITE && (
        <div className="sea-qa-ai-ask-sessions-footer">
          <Button color="primary" className="sea-qa-ai-ask-add-session-btn" onClick={() => togglePageType(ASK_PAGE_TYPE.NEW)}>
            <Icon symbol="add" className="mr-2" />
            {gettext('New chat')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Sessions;
