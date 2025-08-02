import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import HideConnection from './hide-connection';

const HiddenConnections = ({ readOnly, connections, hiddenConnectionTypes, onChange }) => {

  const isEmpty = useMemo(() => {
    if (!Array.isArray(connections) || connections.length === 0) return true;
    return false;
  }, [connections]);

  return (
    <div className={classnames('hide-list', { 'empty-hide-container': isEmpty })}>
      {isEmpty && <div className="empty-hide-list">{window.gettext('No connections available to be hidden')}</div>}
      {!isEmpty && connections.map((column, columnIndex) => {
        return (
          <HideConnection
            key={column.key}
            readOnly={readOnly}
            columnIndex={columnIndex}
            isHidden={!hiddenConnectionTypes.includes(column.type)}
            column={column}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
};

HiddenConnections.propTypes = {
  readOnly: PropTypes.bool,
  hiddenConnectionTypes: PropTypes.array,
  connections: PropTypes.array,
  onChange: PropTypes.func,
};

export default HiddenConnections;
