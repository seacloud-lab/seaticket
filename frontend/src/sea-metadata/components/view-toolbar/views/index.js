import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { IconButton, CustomizeNameDialog } from '@/components';
import { useViewsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import ViewItem from './view-item';
import context from '@/sea-metadata/context';

import './index.css';

const Views = ({ view, toggleView }) => {
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [canViewsScroll, setViewsScroll] = useState(true);
  const [isShowViewNameDialog, setIsShowViewNameDialog] = useState(false);

  const isRenameRef = useRef(false);
  const viewsNavContainerRef = useRef(null);

  const { isLoading, viewsData, insertView, modifyView, moveView, duplicateView, deleteView } = useViewsData();

  const displayViews = useMemo(() => {
    if (isLoading) return [];
    const { navigation, views } = viewsData;
    if (!navigation || !views) return [];
    return navigation.map(n => views.find(v => v._id === n._id));
  }, [isLoading, viewsData, view]);

  const openViewNameDialog = useCallback((isRename) => {
    isRenameRef.current = Boolean(isRename);
    setIsShowViewNameDialog(true);
  }, []);

  const closeViewNameDialog = useCallback(() => {
    isRenameRef.current = false;
    setIsShowViewNameDialog(false);
  }, []);

  const checkAvailableScrollType = useCallback(() => {
    let { offsetWidth, scrollWidth, scrollLeft } = viewsNavContainerRef.current;
    let _canScrollPrev = false;
    let _canScrollNext = false;
    if (scrollLeft > 0) {
      _canScrollPrev = true;
    }
    if (scrollLeft + offsetWidth < scrollWidth) {
      _canScrollNext = true;
    }

    if (_canScrollPrev !== canScrollPrev || _canScrollNext !== canScrollNext) {
      setCanScrollPrev(_canScrollPrev);
      setCanScrollNext(_canScrollNext);
    }
  }, [canScrollPrev, canScrollNext]);

  const onScroll = useCallback(() => {
    checkAvailableScrollType();
  }, [checkAvailableScrollType]);

  const onWheel = useCallback((event) => {
    const { wheelDeltaX, wheelDeltaY } = event.nativeEvent;
    // Mouse wheel scrolls, wheelDeltaY is not 0, wheelDeltaX is 0 (scroll up and down)
    if (wheelDeltaY !== 0 && wheelDeltaX === 0) {
      let tablesScrollLeft = viewsNavContainerRef.current.scrollLeft - wheelDeltaY;
      if (tablesScrollLeft <= 0 && viewsNavContainerRef.current.scrollLeft > 0) {
        viewsNavContainerRef.current.scrollLeft = 0;
        return;
      }
      if (tablesScrollLeft > 0 && tablesScrollLeft < viewsNavContainerRef.current.clientWidth) {
        viewsNavContainerRef.current.scrollLeft = tablesScrollLeft;
      }
    }
  }, []);

  const onScrollControlClick = useCallback((type) => {
    const { offsetWidth, scrollWidth, scrollLeft } = viewsNavContainerRef.current;
    let targetScrollLeft;
    if (type === 'prev') {
      if (scrollLeft === 0) return;
      targetScrollLeft = scrollLeft - offsetWidth;
      targetScrollLeft = targetScrollLeft > 0 ? targetScrollLeft : 0;
    }

    if (type === 'next') {
      if (scrollLeft + offsetWidth === scrollWidth) return;
      targetScrollLeft = scrollLeft + offsetWidth;
      targetScrollLeft = targetScrollLeft > scrollWidth - offsetWidth ? scrollWidth - offsetWidth : targetScrollLeft;
    }

    if (canViewsScroll) {
      setViewsScroll(false);
      let timer = null;
      timer = setInterval(() => {
        let step = (targetScrollLeft - scrollLeft) / 10;
        step = step > 0 ? Math.ceil(step) : Math.floor(step);
        viewsNavContainerRef.current.scrollLeft = viewsNavContainerRef.current.scrollLeft + step;
        if (Math.abs(targetScrollLeft - viewsNavContainerRef.current.scrollLeft) <= Math.abs(step)) {
          viewsNavContainerRef.current.scrollLeft = targetScrollLeft;
          clearInterval(timer);
          setViewsScroll(true);
        }
      }, 15);
    }
  }, [canViewsScroll]);

  useEffect(() => {
    checkAvailableScrollType();
  }, [displayViews, checkAvailableScrollType]);

  const deleteAble = displayViews.length > 1 && context.canDeleteView();
  const moveAble = context.canMoveView();
  const duplicateAble = context.canDuplicateView();
  const newAble = context.canInsertView();
  const modifyAble = context.canModifyView();

  return (
    <>
      <div className="sea-metadata-views">
        <div className="sea-metadata-views-nav-container" ref={viewsNavContainerRef} onScroll={onScroll} onWheel={onWheel}>
          {displayViews.map(v => {
            const isSelect = v._id === view._id;
            return (
              <ViewItem
                key={v._id}
                isSelect={isSelect}
                view={v}
                modifyAble={modifyAble}
                deleteAble={deleteAble}
                moveAble={moveAble}
                duplicateAble={duplicateAble}
                onSelect={toggleView}
                onModify={() => openViewNameDialog(true)}
                onMove={moveView}
                onDelete={deleteView}
                onDuplicate={duplicateView}
              />
            );
          })}
        </div>
        {(canScrollPrev || canScrollNext) && (
          <div className="sea-metadata-views-nav-scroll-control mr-2">
            <IconButton
              icon="left"
              className={classnames('scroll-control-btn scroll-prev', { 'scroll-active': canScrollPrev })}
              onClick={() => onScrollControlClick('prev')}
            />
            <IconButton
              icon="right"
              className={classnames('scroll-control-btn scroll-next ml-2', { 'scroll-active': canScrollNext })}
              onClick={() => onScrollControlClick('next')}
            />
          </div>
        )}
        {newAble && (<IconButton icon="add" onClick={() => openViewNameDialog()} />)}
      </div>
      {isShowViewNameDialog && (
        <CustomizeNameDialog
          title={isRenameRef.current ? gettext('Rename view') : gettext('New view')}
          value={isRenameRef.current ? view.name : ''}
          onToggle={closeViewNameDialog}
          onSubmit={isRenameRef.current ? (name) => modifyView(view._id, { name }) : insertView}
        />
      )}
    </>

  );
};

export default Views;
