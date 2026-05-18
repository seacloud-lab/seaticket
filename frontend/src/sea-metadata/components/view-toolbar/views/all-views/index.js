import { useCallback, useRef, useState, useMemo } from 'react';
import classnames from 'classnames';
import { Icon, ClickOutside, SearchInput } from '@/components';
import { gettext, KeyCodes } from '@/constants';

import './index.css';

const AllViews = ({
  viewID,
  allViews = [],
  isSelected,
  onMove,
  toggleView,
}) => {
  const [isShowDropdownMenu, setIsShowDropdownMenu] = useState(false);
  const [dropRelativePosition, setDropRelativePosition] = useState('');
  const [currentOverViewId, setCurrentOverViewId] = useState('');
  const [searchValue, setSearchValue] = useState('');

  const viewRef = useRef(null);
  const menuStyle = useRef({});
  const enteredCounter = useRef(0);

  const onDragStart = useCallback((event, viewId) => {
    event.stopPropagation();
    event.dataTransfer.setDragImage(event.target.parentNode, 10, 10);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', viewId);
  }, []);

  const onDragEnter = useCallback((event) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current + 1;
  }, []);

  const onDragOver = useCallback((event, viewId) => {
    if (event.dataTransfer.dropEffect === 'copy') return;
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const dropRelativePosition = event.nativeEvent.offsetY <= event.target.clientHeight / 2 ? 'before' : 'after';
    setDropRelativePosition(dropRelativePosition);
    setCurrentOverViewId(viewId);
  }, []);

  const onDragLeave = useCallback((event) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current - 1;
    if (!enteredCounter.current === 0) return;
    setDropRelativePosition('');
    setCurrentOverViewId('');
  }, []);

  const onDrop = useCallback((event, viewId) => {
    event.stopPropagation();
    event.preventDefault();
    enteredCounter.current = 0;

    const moveViewID = event.dataTransfer.getData('text/plain');
    if (moveViewID !== viewId) {
      onMove && onMove(moveViewID, viewId, dropRelativePosition);
    }
    setDropRelativePosition('');
    setCurrentOverViewId('');
  }, [dropRelativePosition, onMove]);

  const openDropdownMenu = useCallback(() => {
    const { left, bottom } = viewRef.current.getBoundingClientRect();
    menuStyle.current = { left, top: bottom + 12 }; // 12 is (view item height) - (all views button height)
    setIsShowDropdownMenu(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsShowDropdownMenu(false);
    setSearchValue('');
  }, [isShowDropdownMenu]);

  const views = useMemo(() => {
    if (searchValue) {
      return allViews.filter(v => v.name.toLowerCase().includes(searchValue.toLowerCase()));
    }
    return allViews;
  }, [allViews, searchValue]);

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

  return (
    <>
      <div className='sea-metadata-view-container sea-metadata-all-views-container' onClick={openDropdownMenu}>
        <div className={classnames('sea-metadata-view-item', { 'active': isSelected })} ref={viewRef}>
          <div className="sea-metadata-view-item-operation-down">
            <Icon symbol="arrow-down" />
          </div>
        </div>
      </div>
      {isShowDropdownMenu && (
        <ClickOutside onClickOutside={closeDropdown}>
          <div
            className="seaqa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu"
            style={menuStyle.current}
          >
            <div className="all-views-search-wrapper">
              <SearchInput
                autoFocus={true}
                isShowSearchIcon={true}
                value={searchValue}
                size={28}
                placeholder={gettext('Search view')}
                onKeyDown={onKeyDown}
                onChange={onSearchValueChange}
              />
            </div>
            <div className="all-views-list-wrapper">
              {views.map((view) => {
                return (
                  <div
                    key={view._id}
                    onClick={() => {toggleView(view._id);}}
                    className={classnames('dropdown-item seaqa-dropdown-item view-item', {
                      'sea-metadata-view-item-next-position-before': dropRelativePosition === 'before' && currentOverViewId === view._id,
                      'sea-metadata-view-item-next-position-after': dropRelativePosition === 'after' && currentOverViewId === view._id,
                    })}
                    onDragStart={(event) => {onDragStart(event, view._id);}}
                    onDragEnter={onDragEnter}
                    onDragOver={(event) => {onDragOver(event, view._id);}}
                    onDragLeave={(event) => {onDragLeave(event, view._id);}}
                    onDrop={(event) => {onDrop(event, view._id);}}
                  >
                    <span className="view-item-left" draggable={true}>
                      <Icon symbol="drag" />
                      {view.name}
                    </span>
                    <span className="view-item-right">
                      {view._id === viewID && <Icon symbol="check-mark" />}
                    </span>
                  </div>
                );
              })}
              {views.length === 0 && (
                <div className="all-views-empty-tip">
                  <div className="sea-metadata-tip-default">{gettext('No results')}</div>
                </div>
              )}
            </div>
          </div>
        </ClickOutside>
      )}
    </>
  );
};

export default AllViews;
