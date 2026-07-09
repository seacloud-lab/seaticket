import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import HideConnectionPopover from './hidden-connection-popover';
import { gettext } from '../../../constants';
import Icon from '../../../components/icon';

const HideConnectionSetter = ({ onConnectionIDsChange, connections }) => {
  const target = 'hide-connection-popover';
  const readOnly = false;
  const [isShowSetter, setShowSetter] = useState(false);

  const [hiddenConnectionIDs, setHiddenConnectionIDs] = useState(() => {
    const cachedValue = localStorage.getItem('seaqa-hidden-connection-ids');
    const hiddenConnectionIDs = cachedValue ? JSON.parse(cachedValue) : [];
    return hiddenConnectionIDs;
  });

  useEffect(() => {
    if (onConnectionIDsChange) {
      onConnectionIDsChange(hiddenConnectionIDs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modifyHiddenConnections = useCallback((newHiddenConnectionIDs) => {
    setHiddenConnectionIDs(newHiddenConnectionIDs);
    localStorage.setItem('seaqa-hidden-connection-ids', JSON.stringify(newHiddenConnectionIDs));
    if (onConnectionIDsChange) {
      onConnectionIDsChange(newHiddenConnectionIDs);
    }
  }, [onConnectionIDsChange]);

  useEffect(() => {
    if (connections.length === 0) return;
    const validConnectionIds = connections.map((c) => c.id);
    const newHiddenConnectionIDs = hiddenConnectionIDs.filter((id) => validConnectionIds.includes(id) || id === '__kb__' || id === '__ticket__');
    modifyHiddenConnections(newHiddenConnectionIDs);
  }, [connections, hiddenConnectionIDs, modifyHiddenConnections]);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const validConnectionIds = connections.map((c) => c.id);
  const hiddenOnConnectionsCount = hiddenConnectionIDs.filter(id => validConnectionIds.includes(id)).length;
  const showConnectionsLen = connections.length - hiddenOnConnectionsCount;
  const kbSelected = !hiddenConnectionIDs.includes('__kb__');
  const ticketSelected = !hiddenConnectionIDs.includes('__ticket__');
  const showSourcesLen = showConnectionsLen + (kbSelected ? 1 : 0) + (ticketSelected ? 1 : 0);

  return (
    <>
      <div
        className="search-filter filter-by-suffix-container"
        id={target}
        onClick={onSetterToggle}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
      >
        <div className={classNames('search-filter-toggle', {
          'active': isShowSetter && showSourcesLen > 0,
          'highlighted': showSourcesLen > 0,
        })} >
          <div className="filter-label">
            {showSourcesLen > 0 ? `${showSourcesLen} ${gettext('Sources')}` : gettext('Sources')}
          </div>
          <Icon symbol="arrow-down"/>
        </div>
      </div>
      {isShowSetter && (
        <HideConnectionPopover
          readOnly={readOnly}
          hiddenConnectionIDs={hiddenConnectionIDs}
          connections={connections}
          target={target}
          placement="bottom-start"
          hidePopover={onSetterToggle}
          onChange={modifyHiddenConnections}
        />
      )}
    </>
  );
};

HideConnectionSetter.propTypes = {
  onConnectionIDsChange: PropTypes.func.isRequired,
  connections: PropTypes.array.isRequired,
};

export default HideConnectionSetter;
