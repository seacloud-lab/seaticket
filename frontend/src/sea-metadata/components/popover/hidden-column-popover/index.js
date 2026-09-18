import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UncontrolledPopover } from 'reactstrap';
import isHotkey from 'is-hotkey';
import PropTypes from 'prop-types';
import SearchInput from '@/components/search-input';
import { gettext, KeyCodes } from '@/constants';
import context from '@/sea-metadata/context';
import { getEventClassName } from '@/utils/dom';
import HiddenColumns from './hidden-columns';

import './index.css';

const HideColumnPopover = ({ hidePopover, onChange, readOnly, target, placement, columns, hiddenColumns: oldHiddenColumns, canReorder, modifyColumnOrder }) => {
  const [searchValue, setSearchValue] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState(oldHiddenColumns);
  const displayColumns = useMemo(() => {
    if (!searchValue) return Array.isArray(columns) ? columns : [];
    const validSearchValueValue = searchValue.trim().toLocaleLowerCase();
    return columns.filter(column => column.display_name.toLocaleLowerCase().indexOf(validSearchValueValue) > -1);
  }, [searchValue, columns]);

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

  const update = useCallback((hiddenColumns) => {
    setHiddenColumns(hiddenColumns);
    onChange(hiddenColumns);
  }, [onChange]);

  const hideColumn = useCallback((columnKey) => {
    const newHiddenColumns = hiddenColumns.slice(0);
    const columnIndex = newHiddenColumns.indexOf(columnKey);
    if (columnIndex > -1) {
      newHiddenColumns.splice(columnIndex, 1);
    } else {
      newHiddenColumns.push(columnKey);
    }
    update(newHiddenColumns);
  }, [hiddenColumns, update]);

  const hideAll = useCallback(() => {
    update(displayColumns.map(column => column.key));
  }, [displayColumns, update]);

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
      className="seaqa-hide-columns-popover"
      boundariesElement={document.body}
    >
      <div
        onClick={onPopoverInsideClick}
        ref={popoverRef}
        className="d-flex flex-column align-items-center w-100 p-2"
        style={{ maxHeight: window.innerHeight - 100 }}
      >
        <div className="w-100 px-2 pt-2">
          <SearchInput
            placeholder={context.translate('Search {column}')}
            onKeyDown={onKeyDown}
            onChange={onChangeSearch}
            onClear={() => setSearchValue('')}
            size={32}
            autoFocus={true}
            isShowClearIcon={!!searchValue}
            isShowSearchIcon={true}
          />
        </div>
        <HiddenColumns
          readOnly={readOnly}
          columns={displayColumns}
          searchValue={searchValue}
          hiddenColumns={hiddenColumns}
          onChange={hideColumn}
          canReorder={canReorder}
          modifyColumnOrder={modifyColumnOrder}
        />
        {!readOnly && !searchValue && (
          <div className="seaqa-hide-columns-operations d-flex justify-content-around p-2 w-100">
            <div className="d-flex align-items-center justify-content-center w-100 border-radius-4 cursor-pointer h-6" onClick={hideAll} aria-label={gettext('Hide all')}>{gettext('Hide all')}</div>
            <div className="d-flex align-items-center justify-content-center w-100 border-radius-4 cursor-pointer h-6" onClick={showAll} aria-label={gettext('Show all')}>{gettext('Show all')}</div>
          </div>
        )}
      </div>
    </UncontrolledPopover>
  );

};

HideColumnPopover.propTypes = {
  readOnly: PropTypes.bool,
  placement: PropTypes.string.isRequired,
  target: PropTypes.string.isRequired,
  hiddenColumns: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  hidePopover: PropTypes.func.isRequired,
  canReorder: PropTypes.bool,
  modifyColumnOrder: PropTypes.func,
};

export default HideColumnPopover;
