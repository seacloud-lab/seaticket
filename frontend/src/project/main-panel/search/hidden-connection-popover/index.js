import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledPopover } from 'reactstrap';
import isHotkey from 'is-hotkey';
import SearchInput from '@/components/search-input';
import HiddenConnections from './hidden-connections';
import { gettext } from '@/constants';
import { KeyCodes } from '@/constants/keyCodes';
import { getEventClassName } from '@/utils/dom';

import './index.css';

const HideConnectionPopover = ({ hidePopover, onChange, readOnly, target, placement, connections, hiddenConnectionIDs: oldHiddenConnections }) => {
  const [searchValue, setSearchValue] = useState('');
  const [hiddenConnectionIDs, setHiddenConnections] = useState(oldHiddenConnections);
  const sources = useMemo(() => {
    let base = Array.isArray(connections) ? [...connections] : [];
    base.push({ id: '__kb__', key: '__kb__', name: gettext('Knowledge Base') });
    base.push({ id: '__ticket__', key: '__ticket__', name: gettext('Ticket') });
    return base;
  }, [connections]);

  const displayItems = useMemo(() => {
    if (!searchValue) return sources;
    const validSearchValueValue = searchValue.trim().toLocaleLowerCase();
    return sources.filter(column => column.name.toLocaleLowerCase().indexOf(validSearchValueValue) > -1);
  }, [searchValue, sources]);

  const popoverRef = useRef(null);

  const hide = useCallback((event) => {
    if (popoverRef.current && !getEventClassName(event).includes('popover') && !popoverRef.current.contains(event.target)) {
      hidePopover(event);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, [hidePopover]);

  const onHotKey = useCallback((event) => {
    if (isHotkey('esc', event)) {
      event.preventDefault();
      hidePopover();
    }
  }, [hidePopover]);

  useEffect(() => {
    document.addEventListener('click', hide, true);
    document.addEventListener('keydown', onHotKey);
    return () => {
      document.removeEventListener('click', hide, true);
      document.removeEventListener('keydown', onHotKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPopoverInsideClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const onKeyDown = useCallback((event) => {
    if (
      event.keyCode === KeyCodes.ChineseInputMethod ||
      event.keyCode === KeyCodes.Enter ||
      event.keyCode === KeyCodes.LeftArrow ||
      event.keyCode === KeyCodes.RightArrow
    ) {
      event.stopPropagation();
    }
  }, []);

  const onChangeSearch = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [searchValue]);

  const update = useCallback((hiddenConnectionIDs) => {
    setHiddenConnections(hiddenConnectionIDs);
    onChange(hiddenConnectionIDs);
  }, [onChange]);

  const hideConnection = useCallback((connection) => {
    const id = connection.id;
    const newHiddenConnections = hiddenConnectionIDs.slice(0);
    const columnIndex = newHiddenConnections.indexOf(id);
    if (columnIndex > -1) {
      newHiddenConnections.splice(columnIndex, 1);
    } else {
      newHiddenConnections.push(id);
    }
    update(newHiddenConnections);
  }, [hiddenConnectionIDs, update]);

  const hideAll = useCallback(() => {
    update(displayItems.map(connection => connection.id));
  }, [displayItems, update]);

  const showAll = useCallback(() => {
    update([]);
  }, [update]);

  return (
    <UncontrolledPopover
      placement={placement}
      isOpen={true}
      target={target}
      fade={false}
      hideArrow={true}
      className="seaqa-hide-popover"
      boundariesElement={document.body}
    >
      <div ref={popoverRef} onClick={onPopoverInsideClick} className="seaqa-hide-container" style={{ maxHeight: window.innerHeight - 100 }}>
        <div className="seaqa-hide-search-container">
          <SearchInput
            placeholder={gettext('Search')}
            onKeyDown={onKeyDown}
            onChange={onChangeSearch}
            autoFocus={true}
            size={28}
          />
        </div>
        <HiddenConnections
          readOnly={readOnly}
          connections={displayItems}
          hiddenConnectionIDs={hiddenConnectionIDs}
          onChange={hideConnection}
        />
        {!readOnly && !searchValue && (
          <div className="seaqa-hide-connections-operations">
            <div
              className="sea-metadata-hide-connections-operation px-2"
              onClick={hideAll}
              aria-label={gettext('Close all')}
            >
              {gettext('Close all')}
            </div>
            <div
              className="sea-metadata-hide-connections-operation px-2"
              onClick={showAll}
              aria-label={gettext('Open all')}
            >
              {gettext('Open all')}
            </div>
          </div>
        )}
      </div>
    </UncontrolledPopover>
  );
};

HideConnectionPopover.propTypes = {
  readOnly: PropTypes.bool,
  placement: PropTypes.string.isRequired,
  target: PropTypes.string.isRequired,
  hiddenConnectionIDs: PropTypes.array.isRequired,
  connections: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  hidePopover: PropTypes.func.isRequired,
  modifyColumnOrder: PropTypes.func,
};

export default HideConnectionPopover;
