import React, { useState, useCallback } from 'react';
import classNames from 'classnames';
import HideConnectionPopover from './hidden-connection-popover';
import { CONNECTION_TYPES } from '../../constants';
import { gettext } from '../../../constants';
import Icon from '../../../components/icon';

const HideConnectionSetter = ({ onConnectionTypesChange }) => {
  const target = 'hide-connection-popover';
  const readOnly = false;
  const [isShowSetter, setShowSetter] = useState(false);

  const [hiddenConnectionTypes, setConnectionTypes] = useState(() => {
    const cachedValue = localStorage.getItem('seaqa-hidden-connection-types');
    const hiddenConnectionTypes = cachedValue ? JSON.parse(cachedValue) : [];
    if (onConnectionTypesChange) {
      onConnectionTypesChange(hiddenConnectionTypes);
    }
    return hiddenConnectionTypes;
  });

  const modifyHiddenConnections = useCallback((newHiddenConnectionTypes) => {
    setConnectionTypes(newHiddenConnectionTypes);
    localStorage.setItem('seaqa-hidden-connection-types', JSON.stringify(newHiddenConnectionTypes));
    if (onConnectionTypesChange) {
      onConnectionTypesChange(newHiddenConnectionTypes);
    }
  }, []);

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
          'active': isShowSetter && CONNECTION_TYPES.length !== hiddenConnectionTypes.length,
          'highlighted': CONNECTION_TYPES.length !== hiddenConnectionTypes.length,
        })} >
          <div className="filter-label" title={gettext('Connections')}>{gettext('Connections')}</div>
          <Icon symbol="down"/>
        </div>
      </div>
      {isShowSetter && (
        <HideConnectionPopover
          readOnly={readOnly}
          hiddenConnectionTypes={hiddenConnectionTypes}
          connections={CONNECTION_TYPES}
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
