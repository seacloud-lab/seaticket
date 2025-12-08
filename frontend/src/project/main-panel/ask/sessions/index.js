import React from 'react';
import { gettext } from '@/constants';
import { useSessions } from '../hooks';
import { EmptyTip, IconButton } from '@/components';
import Session from './session';

import './index.css';

const Sessions = ({ sessionId, permission }) => {
  const { sessions, closeShowSessions } = useSessions();

  return (
    <div className="sea-qa-ai-ask-sessions-wrapper" style={{ width: 300 }}>
      <div className="sea-qa-ai-ask-sessions-header">
        <div>{gettext('Histories')}</div>
        <IconButton icon="x" onClick={closeShowSessions} title={gettext('Close')} aria-label={gettext('Close')} />
      </div>
      <div className="sea-qa-ai-ask-sessions-body">
        {sessions.length === 0 && (
          <EmptyTip text={gettext('No chats')} />
        )}
        {sessions.map(session => {
          const isSelected = sessionId === session._id;
          return (
            <Session key={session._id} session={session} permission={permission} isSelected={isSelected} />
          );
        })}
      </div>
    </div>
  );
};

export default Sessions;
