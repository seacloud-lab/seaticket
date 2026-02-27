import React, { useState, useCallback } from 'react';
import classnames from 'classnames';
import { Icon, IconButton, CustomizeNameDialog, CommonOperationConfirmationDialog } from '@/components';
import { gettext } from '@/constants';

const Sessions = ({ sessions, currentSessionId, onSelectSession, onDeleteSession, onRenameSession, onClose }) => {
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [deletingSessionId, setDeletingSessionId] = useState(null);

  const openRename = useCallback((sessionId, e) => {
    e.stopPropagation();
    setRenamingSessionId(sessionId);
  }, []);

  const closeRename = useCallback(() => {
    setRenamingSessionId(null);
  }, []);

  const openDelete = useCallback((sessionId, e) => {
    e.stopPropagation();
    setDeletingSessionId(sessionId);
  }, []);

  const closeDelete = useCallback(() => {
    setDeletingSessionId(null);
  }, []);

  const handleRename = useCallback((newName) => {
    if (renamingSessionId) {
      onRenameSession(renamingSessionId, newName);
      closeRename();
    }
  }, [renamingSessionId, onRenameSession, closeRename]);

  const handleDelete = useCallback(() => {
    if (deletingSessionId) {
      onDeleteSession(deletingSessionId);
      closeDelete();
    }
  }, [deletingSessionId, onDeleteSession, closeDelete]);

  const renamingSession = sessions.find(s => s.session_uuid === renamingSessionId);
  const deletingSession = sessions.find(s => s.session_uuid === deletingSessionId);

  return (
    <>
      <div className="portal-chat-sessions-wrapper">
        <div className="portal-chat-sessions-header">
          <div>{gettext('Histories')}</div>
          <IconButton icon="close" onClick={onClose} title={gettext('Close')} aria-label={gettext('Close')} />
        </div>
        <div className="portal-chat-sessions-body">
          {sessions.length === 0 && (
            <div className="portal-chat-sessions-empty">{gettext('No chats')}</div>
          )}
          {sessions.map(session => {
            const isSelected = currentSessionId === session.session_uuid;
            return (
              <div
                key={session.session_uuid}
                className={classnames('portal-chat-session-item', { 'active': isSelected })}
                onClick={() => onSelectSession(session.session_uuid)}
              >
                <span className="session-name">{session.session_name}</span>
                <div className="session-operations">
                  <button
                    className="session-operation-btn"
                    onClick={(e) => openRename(session.session_uuid, e)}
                    title={gettext('Rename')}
                  >
                    <Icon symbol="rename" />
                  </button>
                  <button
                    className="session-operation-btn session-delete-btn"
                    onClick={(e) => openDelete(session.session_uuid, e)}
                    title={gettext('Delete')}
                  >
                    <Icon symbol="delete" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {renamingSession && (
        <CustomizeNameDialog
          title={gettext('Rename chat')}
          value={renamingSession.session_name}
          onToggle={closeRename}
          onSubmit={handleRename}
        />
      )}

      {deletingSession && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete chat')}
          message={gettext('Are you sure you want to delete this chat?')}
          executeOperation={handleDelete}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDelete}
        />
      )}
    </>
  );
};

export default Sessions;
