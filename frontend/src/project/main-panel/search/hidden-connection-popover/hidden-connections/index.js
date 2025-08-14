import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import HideConnection from './hide-connection';

const HiddenConnections = ({ readOnly, connections, hiddenConnectionIDs, onChange }) => {

  const isEmpty = useMemo(() => {
    if (!Array.isArray(connections) || connections.length === 0) return true;
    return false;
  }, [connections]);

  return (
    <div className={classnames('hide-list', { 'empty-hide-container': isEmpty })}>
      {isEmpty && <div className="empty-hide-list">{window.gettext('No connections available')}</div>}
      {!isEmpty && connections.map((connection) => {
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
