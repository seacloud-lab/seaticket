import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledPopover } from 'reactstrap';
import isHotkey from 'is-hotkey';
import SearchInput from '../../../../components/search-input';
import HiddenConnections from './hidden-connections';
import { gettext } from '../../../../constants';
import KeyCodes from '../../../../components/select-option-group/KeyCodes';
import { getEventClassName } from '../../../../utils/utils';

import './index.css';

const HideConnectionPopover = ({ hidePopover, onChange, readOnly, target, placement, connections, hiddenConnectionTypes: oldHiddenConnections }) => {
  const [searchValue, setSearchValue] = useState('');
  const [hiddenConnectionTypes, setHiddenConnections] = useState(oldHiddenConnections);
  const displayItems = useMemo(() => {
    if (!searchValue) return Array.isArray(connections) ? connections : [];
    const validSearchValueValue = searchValue.trim().toLocaleLowerCase();
    return connections.filter(column => column.name.toLocaleLowerCase().indexOf(validSearchValueValue) > -1);
  }, [searchValue, connections]);

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

  const update = useCallback((hiddenConnectionTypes) => {
    setHiddenConnections(hiddenConnectionTypes);
    onChange(hiddenConnectionTypes);
  }, [onChange]);

  const hideConnection = useCallback((connection) => {
    const type = connection.type;
    const newHiddenConnections = hiddenConnectionTypes.slice(0);
    const columnIndex = newHiddenConnections.indexOf(type);
    if (columnIndex > -1) {
      newHiddenConnections.splice(columnIndex, 1);
    } else {
      newHiddenConnections.push(type);
    }
    update(newHiddenConnections);
  }, [hiddenConnectionTypes, update]);

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
          <SearchInput placeholder={gettext('Search connection')} onKeyDown={onKeyDown} onChange={onChangeSearch} autoFocus={true} size={28} />
        </div>
        <HiddenConnections
          readOnly={readOnly}
          connections={displayItems}
          hiddenConnectionTypes={hiddenConnectionTypes}
          onChange={hideConnection}
        />
      </div>
    </UncontrolledPopover>
  );

};

HideConnectionPopover.propTypes = {
  readOnly: PropTypes.bool,
  placement: PropTypes.string.isRequired,
  target: PropTypes.string.isRequired,
  hiddenConnectionTypes: PropTypes.array.isRequired,
  connections: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  hidePopover: PropTypes.func.isRequired,
  modifyColumnOrder: PropTypes.func,
};

export default HideConnectionPopover;
