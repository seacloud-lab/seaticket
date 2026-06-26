import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, CustomizeNameDialog } from '@/components';
import classNames from 'classnames';
import { useViewsData } from '@/sea-metadata/hooks';
import { gettext } from '@/constants';
import ViewItem from './view-item';
import AllViews from './all-views';
import context from '@/sea-metadata/context';
import { isFunction } from '@/utils/type-detection';

import './index.css';
import './view-buttons.css';

const Views = ({ view, toggleView }) => {
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [canViewsScroll, setViewsScroll] = useState(true);
  const [isShowViewNameDialog, setIsShowViewNameDialog] = useState(false);

  const isRenameRef = useRef(false);
  const viewsNavContainerRef = useRef(null);
  const isDidMount = useRef(false);

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

  const handleInsertView = useCallback((name) => {
    return insertView(name).then(view => {
      setTimeout(() => viewsNavContainerRef.current.scrollLeft = 100000, 10);
    });
  }, [insertView]);

  const updateScrollBySelectView = useCallback((viewID, viewIndex) => {
    if (!viewsNavContainerRef.current) return;
    const { offsetWidth, scrollWidth } = viewsNavContainerRef.current;
    if (viewIndex === 0) {
      viewsNavContainerRef.current.scrollLeft = 0;
      return;
    }
    if (viewIndex === allViews.length - 1) {
      viewsNavContainerRef.current.scrollLeft = scrollWidth - offsetWidth;
      return;
    }
    const targetViewElement = document.getElementById(`sea-metadata-view-${viewID}`);
    if (!targetViewElement) return;
    const { left: viewsLeft } = viewsNavContainerRef.current.getBoundingClientRect();
    const { left: viewLeft } = targetViewElement.getBoundingClientRect();
    const left = viewLeft - viewsLeft;

    // Judge whether the target element is within the visible area
    if (left < 0 || left > offsetWidth) {
      const childElements = viewsNavContainerRef.current.children;
      let totalWidth = 0;
      for (let index = 0; index <= viewIndex; index++) {
        if (!childElements[index]) break;
        totalWidth += childElements[index].offsetWidth;
      }
      viewsNavContainerRef.current.scrollLeft = totalWidth > offsetWidth ? totalWidth - offsetWidth : 0;
    }
  }, []);

  useEffect(() => {
    checkAvailableScrollType();
  }, [allViews, checkAvailableScrollType]);

  useEffect(() => {
    const dom = viewsNavContainerRef.current;
    const handleResize = () => {
      if (!dom) return;
      setViewsScroll(isContainerOverflowing());
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);

    return () => {
      dom && resizeObserver.unobserve(dom);
    };
  }, []);

  useEffect(() => {
    if (!view?._id) return;
    if (isDidMount.current) return;
    const viewIndex = allViews.findIndex(v => v._id === viewID);
    if (viewIndex === -1) return;
    updateScrollBySelectView(viewID, viewIndex);
    isDidMount.current = true;
  }, [view]);

  const deleteAble = allViews.length > 1 && context.canDeleteView();
  const moveAble = context.canMoveView();
  const duplicateAble = context.canDuplicateView();
  const modifyAble = context.canModifyView();

  return (
    <>
      <div className="sea-metadata-views">
        {canViewsScroll && canScrollPrev && (
          <div className="sea-metadata-views-nav-scroll-btns sea-metadata-views-nav-scroll-btns-left">
            <IconButton
              icon="arrow-left"
              className='scroll-control-btn'
              onClick={() => onScrollControlClick('left')}
              title={gettext('Scroll to the left')}
              aria-label={gettext('Scroll to the left')}
            />
          </div>
        )}
        <div
          ref={viewsNavContainerRef}
          onScroll={onScroll}
          onWheel={onWheel}
          className={classNames('sea-metadata-views-nav-container', canViewsScroll ? 'mr-2' : '')}
        >
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
          <>
            {canScrollNext &&
              <div className="sea-metadata-views-nav-scroll-btns sea-metadata-views-nav-scroll-btns-right">
                <IconButton
                  icon="arrow-right"
                  className='scroll-control-btn'
                  onClick={() => onScrollControlClick('right')}
                  title={gettext('Scroll to the right')}
                  aria-label={gettext('Scroll to the right')}
                />
              </div>
            }
            <AllViews
              viewID={viewID}
              allViews={allViews}
              onMove={moveView}
              toggleView={(viewID, viewIndex) => {
                toggleView(viewID);
                updateScrollBySelectView(viewID, viewIndex);
              }}
            />
          </>
        )}
        {context.canInsertView() &&
          <div style={{ borderLeft: '1px solid #EAEAEA' }}>
            <IconButton
              icon="plus"
              className="ml-2"
              onClick={() => openViewNameDialog()}
              title={gettext('Add view')}
              aria-label={gettext('Add view')}
            />
          </div>
        }
      </div>
      {isShowViewNameDialog && (
        <CustomizeNameDialog
          title={isRenameRef.current ? gettext('Rename view') : gettext('New view')}
          value={isRenameRef.current ? (getViewById(view._id)?.name || '') : ''}
          onToggle={closeViewNameDialog}
          onSubmit={isRenameRef.current ? (name) => modifyView(view._id, { name }) : handleInsertView}
        />
      )}
    </>
  );
};

export default Views;
