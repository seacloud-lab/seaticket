import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { IconButton } from '@/components';
import Cell from './cell';

import './index.css';

const Header = forwardRef(({
  columns,
  canResize,
  isShowScrollBtn,
  scrollLeft,
  setItemScrollLeft,
  setScrollLeft,
  modifyColumnWidth,
}, ref) => {
  const [canScroll, setCanScroll] = useState(true);
  const [navScrollWidth, setNavScrollWidth] = useState(0);
  const [navWidth, setNavWidth] = useState(0);

  const columnNamesRef = useRef(null);
  const timer = useRef(null);

  const onScrollControlClick = useCallback((type) => {
    const { offsetWidth, scrollWidth, scrollLeft } = columnNamesRef.current;
    let targetScrollLeft;
    if (type === 'prev') {
      if (scrollLeft === 0) {
        return;
      }
      targetScrollLeft = scrollLeft - offsetWidth;
      targetScrollLeft = targetScrollLeft > 0 ? targetScrollLeft : 0;
    }

    if (type === 'next') {
      if (scrollLeft + offsetWidth === scrollWidth) {
        return;
      }
      targetScrollLeft = scrollLeft + offsetWidth;
      targetScrollLeft = targetScrollLeft > scrollWidth - offsetWidth ? scrollWidth - offsetWidth : targetScrollLeft;
    }

    if (canScroll) {
      setCanScroll(false);
      let timer = null;
      let step = (targetScrollLeft - scrollLeft) / 10;
      step = step > 0 ? Math.ceil(step) : Math.floor(step);
      timer = setInterval(() => {
        columnNamesRef.current.scrollLeft = columnNamesRef.current.scrollLeft + step;
        if (Math.abs(targetScrollLeft - columnNamesRef.current.scrollLeft) <= Math.abs(step)) {
          columnNamesRef.current.scrollLeft = targetScrollLeft;
          clearInterval(timer);
          setCanScroll(true);
        }
      }, 30);
    }
  }, [canScroll]);

  const onScroll = useCallback(() => {
    const { scrollLeft } = columnNamesRef.current;
    setItemScrollLeft(scrollLeft, -1);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    timer.current = setTimeout(() => {
      setScrollLeft(scrollLeft);
    }, 60);
  }, [setItemScrollLeft, setScrollLeft]);

  useLayoutEffect(() => {
    if (!columnNamesRef.current) return;
    const { offsetWidth, scrollWidth } = columnNamesRef.current;
    if (navScrollWidth !== scrollWidth || navWidth !== offsetWidth) {
      setNavScrollWidth(scrollWidth);
      setNavWidth(offsetWidth);
    }
  }, [navScrollWidth, navWidth]);

  useImperativeHandle(ref, () => ({
    setScrollLeft: (scrollLeft) => columnNamesRef.current.scrollLeft = scrollLeft,
  }), []);

  return (
    <div className="sea-metadata-card-header">
      <div className="sea-metadata-card-column-names">
        {isShowScrollBtn && (
          <IconButton
            icon="arrow-down-b"
            className="rotate-icon-90 sea-metadata-card-header-scroll-btn sea-metadata-card-header-scroll-prev-btn"
            disabled={scrollLeft <= 0}
            onClick={() => onScrollControlClick('prev')}
          />
        )}
        <div className="sea-metadata-card-columns-container" onScroll={onScroll} ref={columnNamesRef}>
          <div className="d-inline-flex">
            {columns.map(column => {
              return (
                <Cell column={column} key={column?.key} canResize={canResize} modifyColumnWidth={modifyColumnWidth} />
              );
            })}
          </div>
        </div>
        {isShowScrollBtn && (
          <IconButton
            icon="arrow-down-b"
            className="rotate-icon-270 sea-metadata-card-header-scroll-btn sea-metadata-card-header-scroll-next-btn"
            disabled={scrollLeft + navWidth >= navScrollWidth}
            onClick={() => onScrollControlClick('next')}
          />
        )}
      </div>
    </div>
  );
});

export default Header;
