import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import { gettext } from '../../../../constants';
import './index.css';

const SidePanel = ({
  chatSessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNewSession = useCallback(() => {
    onNewSession();
  }, [onNewSession]);

  const handleSessionClick = useCallback((sessionId) => {
    onSessionSelect(sessionId);
  }, [onSessionSelect]);

  const handleDeleteSession = useCallback((sessionId, e) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
  }, [onDeleteSession]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  return (
    <div className={classnames('ask-side-panel', { collapsed: isCollapsed })}>
      <div className="ask-side-panel-header">
        <div className="ask-side-panel-title">
          {!isCollapsed && gettext('Histories')}
        </div>
        <button 
          className="ask-side-panel-toggle"
          onClick={toggleCollapse}
          title={isCollapsed ? gettext('Expand') : gettext('Collapse')}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="ask-side-panel-content">
            <div className="ask-sessions-list">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={classnames('ask-session-item', {
                    active: session.session_uuid === currentSessionId
                  })}
                  onClick={() => handleSessionClick(session.session_uuid)}
                >
                  <div className="ask-session-title">
                    {session.title || gettext('New Chat')}
                  </div>
                  <button
                    className="ask-session-delete"
                    onClick={(e) => handleDeleteSession(session.session_uuid, e)}
                    title={gettext('Delete')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="ask-side-panel-footer">
            <button
              className="ask-new-session-btn"
              onClick={handleNewSession}
            >
              + {gettext('New Chat')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SidePanel;
