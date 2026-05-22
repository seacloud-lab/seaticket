import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import classnames from 'classnames';
import { SearchInput, IconButton, CustomizeDropdownItemText, CustomizePopover, EmptyTip } from '@/components';
import { gettext, KeyCodes, mediaUrl } from '@/constants';
import context from '@/sea-metadata/context';

import './index.css';

const AllViews = ({
  viewID,
  allViews = [],
  onMove,
  toggleView,
}) => {
  const [isShowAllViewsPopover, setIsShowAllViewsPopover] = useState(false);
  const [dropRelativePosition, setDropRelativePosition] = useState('');
  const [currentOverViewId, setCurrentOverViewId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [maxHeight, setMaxHeight] = useState(window.innerHeight - 100);

  const viewRef = useRef(null);
  const enteredCounter = useRef(0);

  const canManageView = context.getSetting('canManageView', true);

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

  const openAllViewsPopover = useCallback(() => {
    setMaxHeight(window.innerHeight - 100);
    setIsShowAllViewsPopover(true);
  }, []);

  const closeAllViewsPopover = useCallback(() => {
    setIsShowAllViewsPopover(false);
    setSearchValue('');
  }, [isShowAllViewsPopover]);

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

  useEffect(() => {
    if (!isShowAllViewsPopover) return;
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight - 100);
    };
    window.addEventListener('resize', updateMaxHeight);
    return () => {
      window.removeEventListener('resize', updateMaxHeight);
    };
  }, [isShowAllViewsPopover]);

  return (
    <>
      <IconButton
        icon="arrow-down"
        className="sea-metadata-all-views-btn"
        ref={viewRef}
        onClick={openAllViewsPopover}
      />
      {isShowAllViewsPopover && (
        <CustomizePopover
          target={viewRef}
          className="sea-metadata-all-views-popover"
          hidePopover={closeAllViewsPopover}
          hidePopoverWithEsc={closeAllViewsPopover}
        >
          <div className={classnames('sea-metadata-all-views-container', { 'pb-2': views.length === 0 })} style={{ maxHeight }}>
            <div className="sea-metadata-all-views-search-wrapper">
              <SearchInput
                autoFocus={true}
                isShowSearchIcon={true}
                value={searchValue}
                size={32}
                placeholder={gettext('Search view')}
                onKeyDown={onKeyDown}
                onChange={onSearchValueChange}
              />
            </div>
            <div className="sea-metadata-all-views-content-wrapper" >
              {views.map((view) => {
                return (
                  <div
                    key={view._id}
                    onClick={() => toggleView(view._id)}
                    className={classnames('sea-metadata-all-views-item', {
                      'sea-metadata-all-views-item-next-position-before': dropRelativePosition === 'before' && currentOverViewId === view._id,
                      'sea-metadata-all-views-item-next-position-after': dropRelativePosition === 'after' && currentOverViewId === view._id,
                    })}
                    onDragStart={(event) => {onDragStart(event, view._id);}}
                    onDragEnter={onDragEnter}
                    onDragOver={(event) => {onDragOver(event, view._id);}}
                    onDragLeave={(event) => {onDragLeave(event, view._id);}}
                    onDrop={(event) => {onDrop(event, view._id);}}
                  >
                    <div className="sea-metadata-all-views-item-left text-truncate" draggable={true} title={view.name}>
                      {canManageView && (<IconButton icon="drag" className="sea-metadata-all-views-item-drag-btn mr-3" />)}
                      <CustomizeDropdownItemText>{view.name}</CustomizeDropdownItemText>
                    </div>
                    <IconButton icon={view._id === viewID ? 'check-mark-option' : ''} className="no-hover-bg" />
                  </div>
                );
              })}
              {views.length === 0 && (
                <EmptyTip src={`${mediaUrl}img/no-results.png`} text={gettext('No results')} className="option-editor-no-results-tip" />
              )}
            </div>
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default AllViews;
