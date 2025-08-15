import React, { useState, useCallback, useEffect } from 'react';
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
    const newHiddenConnectionIDs = hiddenConnectionIDs.filter((id) => validConnectionIds.includes(id));
    modifyHiddenConnections(newHiddenConnectionIDs);
  }, [connections]);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
  }, [onSetterToggle]);

  return (
    <>
      <div className="search-filter filter-by-suffix-container" id={target} onClick={onSetterToggle} onKeyDown={onKeyDown} tabIndex={0} role="button">
        <div className={classNames('search-filter-toggle', {
          'active': isShowSetter && connections.length !== hiddenConnectionIDs.length,
          'highlighted': connections.length !== hiddenConnectionIDs.length,
        })} >
          <div className="filter-label" title={gettext('Connections')}>{gettext('Connections')}</div>
          <Icon symbol="down"/>
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
};

export default HideConnectionSetter;
