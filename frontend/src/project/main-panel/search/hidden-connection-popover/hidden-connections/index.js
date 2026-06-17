import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconButton from '@/components/icon-button';
import HideConnection from './hide-connection';
import { DOCUMENT_CONNECTION_TYPE_MAP, ISSUE_CONNECTION_TYPE_MAP, TASK_CONNECTION_TYPE_MAP } from '../../../connections/constants';

const HiddenConnections = ({ readOnly, connections, hiddenConnectionIDs, onChange }) => {
  const [isDocumentsCollapsed, setIsDocumentsCollapsed] = useState(false);
  const [isIssuesCollapsed, setIsIssuesCollapsed] = useState(false);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);

  const toggleDocuments = useCallback(() => {
    setIsDocumentsCollapsed((prev) => !prev);
  }, []);

  const toggleIssues = useCallback(() => {
    setIsIssuesCollapsed((prev) => !prev);
  }, []);

  const toggleTasks = useCallback(() => {
    setIsTasksCollapsed((prev) => !prev);
  }, []);

  const isEmpty = useMemo(() => {
    if (!Array.isArray(connections) || connections.length === 0) return true;
    return false;
  }, [connections]);

  const documentConnections = useMemo(() => {
    return connections.filter((connection) => {
      if (connection.id === '__kb__') return true;
      if (connection.id === '__ticket__') return false;
      if (DOCUMENT_CONNECTION_TYPE_MAP[connection.type]) return true;
      if (ISSUE_CONNECTION_TYPE_MAP[connection.type]) return false;
      if (TASK_CONNECTION_TYPE_MAP[connection.type]) return false;
      return false;
    });
  }, [connections]);

  const issueConnections = useMemo(() => {
    return connections.filter((connection) => {
      if (connection.id === '__ticket__') return true;
      if (DOCUMENT_CONNECTION_TYPE_MAP[connection.type]) return false;
      if (ISSUE_CONNECTION_TYPE_MAP[connection.type]) return true;
      if (TASK_CONNECTION_TYPE_MAP[connection.type]) return false;
      return false;
    });
  }, [connections]);

  const taskConnections = useMemo(() => {
    return connections.filter((connection) => {
      if (DOCUMENT_CONNECTION_TYPE_MAP[connection.type]) return false;
      if (ISSUE_CONNECTION_TYPE_MAP[connection.type]) return false;
      if (TASK_CONNECTION_TYPE_MAP[connection.type]) return true;
      return false;
    });
  }, [connections]);

  return (
    <div className={classnames('hide-list', { 'empty-hide-container': isEmpty })}>
      {isEmpty && <div className="empty-hide-list">{window.gettext('No connections available')}</div>}
      {documentConnections.length > 0 && (
        <div className="hide-list-container">
          <div className="hide-list-title hide-list-title-row">
            <span className="hide-list-title-text">{window.gettext('Documents')}</span>
            <IconButton
              className={classnames('hide-list-title-toggle', { 'collapsed': isDocumentsCollapsed })}
              icon="arrow-down"
              type="button"
              aria-label={isDocumentsCollapsed ? window.gettext('Expand Documents') : window.gettext('Collapse Documents')}
              onClick={toggleDocuments}
            />
          </div>
          {!isDocumentsCollapsed && documentConnections.map((connection) => {
            return (
              <HideConnection
                key={connection.key}
                readOnly={readOnly}
                isHidden={!hiddenConnectionIDs.includes(connection.id)}
                connection={connection}
                onChange={onChange}
              />
            );
          })}
          <div className="hide-list-container-divider pb-2 mb-1 ml-2 mr-2"></div>
        </div>
      )}
      {issueConnections.length > 0 && (
        <div className="hide-list-container">
          <div className="hide-list-title hide-list-title-row">
            <span className="hide-list-title-text">{window.gettext('Issues')}</span>
            <IconButton
              className={classnames('hide-list-title-toggle', { 'collapsed': isIssuesCollapsed })}
              icon="arrow-down"
              type="button"
              aria-label={isIssuesCollapsed ? window.gettext('Expand Issues') : window.gettext('Collapse Issues')}
              onClick={toggleIssues}
            />
          </div>
          {!isIssuesCollapsed && issueConnections.map((connection) => {
            return (
              <HideConnection
                key={connection.key}
                readOnly={readOnly}
                isHidden={!hiddenConnectionIDs.includes(connection.id)}
                connection={connection}
                onChange={onChange}
              />
            );
          })}
          <div className="hide-list-container-divider pb-2 mb-1 ml-2 mr-2"></div>
        </div>
      )}
      {taskConnections.length > 0 && (
        <div className="hide-list-container">
          <div className="hide-list-title hide-list-title-row">
            <span className="hide-list-title-text">{window.gettext('Task')}</span>
            <IconButton
              className={classnames('hide-list-title-toggle', { 'collapsed': isTasksCollapsed })}
              icon="arrow-down"
              type="button"
              aria-label={isTasksCollapsed ? window.gettext('Expand Task') : window.gettext('Collapse Task')}
              onClick={toggleTasks}
            />
          </div>
          {!isTasksCollapsed && taskConnections.map((connection) => {
            return (
              <HideConnection
                key={connection.key}
                readOnly={readOnly}
                isHidden={!hiddenConnectionIDs.includes(connection.id)}
                connection={connection}
                onChange={onChange}
              />
            );
          })}
          <div className="hide-list-container-divider pb-2 mb-1 ml-2 mr-2"></div>
        </div>
      )}
    </div>
  );
};

HiddenConnections.propTypes = {
  readOnly: PropTypes.bool,
  hiddenConnectionIDs: PropTypes.array,
  connections: PropTypes.array,
  onChange: PropTypes.func,
};

export default HiddenConnections;
