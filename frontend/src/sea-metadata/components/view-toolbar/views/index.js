import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { IconButton, CustomizeNameDialog } from '@/components';
import { useViewsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import ViewItem from './view-item';
import AllViews from './all-views';
import context from '@/sea-metadata/context';
import { isFunction } from '@/utils/type-detection';

import './index.css';

const Views = ({ view, toggleView }) => {
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [canViewsScroll, setViewsScroll] = useState(true);
  const [isShowViewNameDialog, setIsShowViewNameDialog] = useState(false);

  const isRenameRef = useRef(false);
  const viewsNavContainerRef = useRef(null);

  const { isLoading, viewsData, viewID, insertView, modifyView, moveView, duplicateView, deleteView, getViewById } = useViewsData();

  const allViews = useMemo(() => {
    if (isLoading) return [];
    const { navigation, views } = viewsData;
    if (!navigation || !views) return [];
    return navigation.map(n => {
      const curView = views.find(v => v._id === n._id);
      if (curView._id === view._id) return { ...curView, is_locked: view.is_locked };
      return curView;
    });
  }, [isLoading, viewsData, view]);

  const isSelected = useMemo(() => {
    if (viewID && !allViews.find(v => v._id === viewID)) return true;
    return false;
  }, [allViews, viewID]);

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
    if (scrollLeft + offsetWidth + 1 < scrollWidth) {
      _canScrollNext = true;
    }
    if (_canScrollPrev !== canScrollPrev || _canScrollNext !== canScrollNext) {
      setCanScrollPrev(_canScrollPrev);
      setCanScrollNext(_canScrollNext);
    }
  }, [canScrollPrev, canScrollNext]);

  const isContainerOverflowing = useCallback(() => {
    if (!viewsNavContainerRef.current) {
      return false;
    }
    const container = viewsNavContainerRef.current;
    const containerWidth = container.offsetWidth;
    const childrenTotalWidth = container.scrollWidth;
    return childrenTotalWidth > containerWidth;
  }, []);

  useEffect(() => {
    setViewsScroll(isContainerOverflowing());
    const handleResize = () => {
      setViewsScroll(isContainerOverflowing());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isContainerOverflowing]);

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
    if (type === 'left') {
      if (scrollLeft === 0) return;
      targetScrollLeft = Math.max(scrollLeft - offsetWidth, 0);
    }
    else if (type === 'right') {
      if (scrollLeft + offsetWidth === scrollWidth) return;
      targetScrollLeft = Math.min(scrollLeft + offsetWidth, scrollWidth - offsetWidth);
    }

    let timer = null;
    const startScrollLeft = scrollLeft;
    const distance = targetScrollLeft - startScrollLeft;
    const stepCount = 20;
    let currentStep = 0;
    timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / stepCount;
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const newScrollLeft = startScrollLeft + distance * easeProgress;
      viewsNavContainerRef.current.scrollLeft = newScrollLeft;
      if (currentStep >= stepCount) {
        viewsNavContainerRef.current.scrollLeft = targetScrollLeft;
        clearInterval(timer);
      }
    }, 16);
  }, []);

  useEffect(() => {
    checkAvailableScrollType();
  }, [allViews, checkAvailableScrollType]);

  const deleteAble = allViews.length > 1 && context.canDeleteView();
  const moveAble = context.canMoveView();
  const duplicateAble = context.canDuplicateView();
  const modifyAble = context.canModifyView();

  return (
    <>
      <div className="sea-metadata-views">
        <div className="sea-metadata-views-nav-container" ref={viewsNavContainerRef} onScroll={onScroll} onWheel={onWheel}>
          {allViews.map(v => {
            const isSelect = isFunction(toggleView) && v._id === viewID;
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
        {canViewsScroll && (
          <div className="sea-metadata-views-nav-scroll-btns d-flex align-items-center mr-2">
            <AllViews
              viewID={viewID}
              allViews={allViews}
              isSelected={isSelected}
              onMove={moveView}
              toggleView={toggleView}
            />
            <IconButton
              icon="arrow-left"
              className={classnames('scroll-control-btn scroll-prev', { 'scroll-active': canScrollPrev })}
              onClick={() => onScrollControlClick('left')}
              title={gettext('Scroll to the left')}
              aria-label={gettext('Scroll to the left')}
            />
            <IconButton
              icon="arrow-right"
              className={classnames('scroll-control-btn scroll-next ml-2', { 'scroll-active': canScrollNext })}
              onClick={() => onScrollControlClick('right')}
              title={gettext('Scroll to the right')}
              aria-label={gettext('Scroll to the right')}
            />
          </div>
        )}
        {context.canInsertView() &&
          <IconButton
            icon="plus"
            onClick={() => openViewNameDialog()}
            title={gettext('Add view')}
            aria-label={gettext('Add view')}
          />
        }
      </div>
      {isShowViewNameDialog && (
        <CustomizeNameDialog
          title={isRenameRef.current ? gettext('Rename view') : gettext('New view')}
          value={isRenameRef.current ? (getViewById(view._id)?.name || '') : ''}
          onToggle={closeViewNameDialog}
          onSubmit={isRenameRef.current ? (name) => modifyView(view._id, { name }) : insertView}
        />
      )}
    </>
  );
};

export default Views;
