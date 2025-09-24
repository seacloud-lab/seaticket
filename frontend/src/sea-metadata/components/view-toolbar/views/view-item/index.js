import { useCallback, useRef, useState, useMemo } from 'react';
import classnames from 'classnames';
import { Icon, CommonOperationConfirmationDialog, ClickOutside, ModalPortal, SearchInput } from '@/components';
import { gettext, KeyCodes } from '@/constants';
import { isFunction } from '@/utils/utils';

import './index.css';

const ViewItem = ({
  type,
  view,
  viewID,
  allViews = {},
  isSelect,
  toggleView,
  modifyAble,
  deleteAble,
  moveAble,
  duplicateAble,
  onSelect,
  onModify,
  onMove,
  onDelete,
  onDuplicate,
}) => {
  const [isShowDropdownMenu, setIsShowDropdownMenu] = useState(false);
  const [dropRelativePosition, setDropRelativePosition] = useState('');
  const [isShowDeleteConfirmationDialog, setIsShowDeleteConfirmationDialog] = useState(false);
  const [switchViewDropRelativePosition, setSwitchViewDropRelativePosition] = useState('');
  const [currentOverViewId, setCurrentOverViewId] = useState('');
  const [searchValue, setSearchValue] = useState('');

  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const menuStyle = useRef({});

  const enteredCounter = useRef(0);

  const onDragStart = useCallback((event, viewId) => {
    event.stopPropagation();

    if (viewId) {
      event.dataTransfer.setDragImage(event.target.parentNode, 10, 10);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', viewId);
      return;
    }
    event.dataTransfer.setDragImage(containerRef.current, 10, 10);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', view._id);
  }, [view]);

  const onDragEnter = useCallback((event) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current + 1;
  }, []);

  const onDragOver = useCallback((event, viewId) => {
    if (event.dataTransfer.dropEffect === 'copy') return;
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (viewId) {
      const switchViewDropRelativePosition = event.nativeEvent.offsetY <= event.target.clientHeight / 2 ? 'before' : 'after';
      setSwitchViewDropRelativePosition(switchViewDropRelativePosition);
      setCurrentOverViewId(viewId);
      return;
    }
    const dropRelativePosition = event.nativeEvent.offsetX <= event.target.clientWidth / 2 ? 'before' : 'after';
    setDropRelativePosition(dropRelativePosition);
  }, []);

  const onDragLeave = useCallback((event, viewId) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current - 1;
    if (!enteredCounter.current === 0) return;
    if (viewId) {
      setSwitchViewDropRelativePosition('');
      setCurrentOverViewId('');
      return;
    }
    setDropRelativePosition('');
  }, []);

  const onDrop = useCallback((event, viewId) => {
    event.stopPropagation();
    event.preventDefault();

    enteredCounter.current = 0;

    const moveViewID = event.dataTransfer.getData('text/plain');
    if (viewId) {
      if (moveViewID !== viewId) {
        onMove && onMove(moveViewID, viewId, switchViewDropRelativePosition);
      }
      setSwitchViewDropRelativePosition('');
      setCurrentOverViewId('');
      return;
    }

    const { _id } = view;
    if (moveViewID !== _id) {
      onMove && onMove(moveViewID, _id, dropRelativePosition);
    }
    setDropRelativePosition('');
  }, [view, dropRelativePosition, switchViewDropRelativePosition, onMove]);

  const openDropdownMenu = useCallback(() => {
    let { left, bottom } = viewRef.current.getBoundingClientRect();
    type === 'switch' && (bottom = bottom + 12); // 12 is (view item height) - (switch view item height)
    menuStyle.current = { left, top: bottom };
    setIsShowDropdownMenu(true);
  }, [type]);

  const closeDropdown = useCallback(() => {
    setIsShowDropdownMenu(false);
  }, [isShowDropdownMenu]);

  const openDeleteConfirmationDialog = useCallback(() => {
    setIsShowDropdownMenu(false);
    setIsShowDeleteConfirmationDialog(true);
  }, []);

  const closeDeleteConfirmationDialog = useCallback(() => {
    setIsShowDeleteConfirmationDialog(false);
  }, []);

  const handleModify = useCallback(() => {
    setIsShowDropdownMenu(false);
    onModify && onModify();
  }, [onModify]);

  const handleDuplicate = useCallback(() => {
    setIsShowDropdownMenu(false);
    onDuplicate && onDuplicate(view._id);
  }, [view, onDuplicate]);

  const switchList = useMemo(() => {
    const { matchViews = [] } = allViews;
    if (searchValue) {
      return matchViews.filter(v => v.name.toLowerCase().includes(searchValue.toLowerCase()));
    }
    return matchViews;
  }, [allViews, searchValue]);

  const isSelectedFoldView = useMemo(() => {
    const { displayViews = [] } = allViews;
    if (viewID && !displayViews.find(v => v._id === viewID)) return true;
    return false;
  }, [allViews, viewID]);

  const onKeyDown = useCallback((event) => {
    if (
      event.keyCode === KeyCodes.ChineseInputMethod ||
        event.keyCode === KeyCodes.LeftArrow ||
        event.keyCode === KeyCodes.RightArrow
    ) {
      event.stopPropagation();
    }
  }, []);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [searchValue]);

  const props = moveAble ? { onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, draggable: 'true' } : {};

  return (
    <>
      <div
        className={classnames('sea-metadata-view-container', {
          'sea-metadata-view-switch-container': type === 'switch',
          'sea-metadata-view-next-position-before': dropRelativePosition === 'before',
          'sea-metadata-view-next-position-after': dropRelativePosition === 'after'
        })}
        ref={containerRef}
        { ...props }
        onClick={type === 'switch' ? openDropdownMenu : () => {}}
      >
        <div
          className={classnames('sea-metadata-view-item', { 'active': isSelect || isSelectedFoldView, 'disabled': !isFunction(onSelect) })}
          onClick={() => onSelect && onSelect(view._id)} key={view._id}
          ref={viewRef}
        >
          {view.name}
          {type === 'switch' && (<div className="sea-metadata-view-item-operation-down">{<Icon symbol="down" />}</div>)}
          {isSelect && (<div className="sea-metadata-view-item-operation-down" onClick={openDropdownMenu}>{<Icon symbol="down" />}</div>)}
        </div>
      </div>
      {isShowDeleteConfirmationDialog && (
        <CommonOperationConfirmationDialog
          toggleDialog={closeDeleteConfirmationDialog}
          title={gettext('Delete view')}
          message={gettext('Are you sure you want to delete view {placeholder} ?').replace('{placeholder}', `<b>${view.name}</b>`)}
          confirmBtnText={gettext('Delete')}
          executeOperation={() => onDelete(view._id)}
        />
      )}
      {isShowDropdownMenu && (
        <ModalPortal>
          <ClickOutside onClickOutside={closeDropdown}>
            <div
              className="sea-qa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu"
              style={menuStyle.current}
            >
              {modifyAble && (
                <button onClick={handleModify} className="dropdown-item sea-qa-dropdown-item">
                  <Icon symbol="rename" />
                  {gettext('Rename view')}
                </button>
              )}
              {duplicateAble && (
                <button onClick={handleDuplicate} className="dropdown-item sea-qa-dropdown-item">
                  <Icon symbol="copy" />
                  {gettext('Duplicate view')}
                </button>
              )}
              {deleteAble && (
                <button onClick={openDeleteConfirmationDialog} className="dropdown-item sea-qa-dropdown-item">
                  <Icon symbol="delete" />
                  {gettext('Delete view')}
                </button>
              )}
              {type === 'switch' && (
                <>
                  <div className="switch-view-search-wrapper">
                    <SearchInput
                      isShowSearchIcon={true}
                      value={searchValue}
                      size={28}
                      placeholder={gettext('Search view')}
                      onKeyDown={onKeyDown}
                      onChange={onSearchValueChange}
                    />
                  </div>
                  <div className="switch-view-list-wrapper">
                    {switchList.map((view) => {
                      return (
                        <div
                          key={view._id}
                          onClick={() => {toggleView(view._id);}}
                          className={classnames('dropdown-item sea-qa-dropdown-item switch-view-item', {
                            'sea-metadata-switch-view-next-position-before': switchViewDropRelativePosition === 'before' && currentOverViewId === view._id,
                            'sea-metadata-switch-view-next-position-after': switchViewDropRelativePosition === 'after' && currentOverViewId === view._id,
                          })}
                          onDragStart={(event) => {onDragStart(event, view._id);}}
                          onDragEnter={onDragEnter}
                          onDragOver={(event) => {onDragOver(event, view._id);}}
                          onDragLeave={(event) => {onDragLeave(event, view._id);}}
                          onDrop={(event) => {onDrop(event, view._id);}}
                        >
                          <span className="switch-view-item-left" draggable={true}>
                            <Icon symbol="drag" />
                            {view.name}
                          </span>
                          <span className="switch-view-item-right">
                            {view._id === viewID && <Icon symbol="check" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </ClickOutside>
        </ModalPortal>
      )}
    </>
  );
};

export default ViewItem;
