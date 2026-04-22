import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import HideConnection from './hide-connection';
import { DOCUMENT_CONNECTION_TYPE_MAP, ISSUE_CONNECTION_TYPE_MAP } from '../../../connections/constants';

const HiddenConnections = ({ readOnly, connections, hiddenConnectionIDs, onChange }) => {

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
      return false;
    });
  }, [connections]);

  const issueConnections = useMemo(() => {
    return connections.filter((connection) => {
      if (connection.id === '__ticket__') return true;
      if (DOCUMENT_CONNECTION_TYPE_MAP[connection.type]) return false;
      if (ISSUE_CONNECTION_TYPE_MAP[connection.type]) return true;
      return false;
    });
  }, [connections]);

  return (
    <div className={classnames('hide-list', { 'empty-hide-container': isEmpty })}>
      {isEmpty && <div className="empty-hide-list">{window.gettext('No connections available')}</div>}
      {documentConnections.length > 0 && <div className="hide-list-title">{window.gettext('Documents')}</div>}
      {documentConnections.length > 0 && documentConnections.map((connection) => {
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
      {issueConnections.length > 0 && <div className="hide-list-title">{window.gettext('Issues')}</div>}
      {issueConnections.length > 0 && issueConnections.map((connection) => {
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
