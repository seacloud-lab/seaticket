import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './header';
import Row from './row';
import { KeyCodes } from '@/constants';
import { useSelectedRows } from '@/sea-metadata/hooks';

import './index.css';

const CARD_ITEM_HEIGHT = 98;
const RENDER_MORE_NUMBER = 20;

const Main = ({
  metadata,
  isMultipleSelect = false,
  columns, rows,
  mode = 'add',
  canResize = true,
  isShowHeader = true,
  isShowScrollBtn = true,
  modifyColumnWidth,
  onRowClick,
  loadMore,
}) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [startRenderIndex, setStartRenderIndex] = useState(0);
  const [endRenderIndex, setEndRenderIndex] = useState(Math.ceil(window.innerHeight / CARD_ITEM_HEIGHT) + RENDER_MORE_NUMBER);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const rowsCount = useMemo(() => rows.length, [rows]);
  const titleColumnKey = useMemo(() => columns.find(c => c.is_name_column)?.key, [columns]);

  const headerRef = useRef(null);
  const rowsContainer = useRef(null);
  const rowsDom = useRef({});

  const { selectedRowIds, updateSelectedRowIds } = useSelectedRows();

  const setItemScrollLeft = useCallback((scrollLeft, domKey) => {
    if (isShowHeader && domKey !== -1) headerRef.current.setScrollLeft(scrollLeft);
    Object.keys(rowsDom.current).forEach(key => {
      const recordDomRef = rowsDom.current[key];
      if (key !== domKey && recordDomRef) {
        const recordScrollLeft = recordDomRef.getScrollLeft();
        if (recordScrollLeft !== scrollLeft) {
          recordDomRef.setScrollLeft(scrollLeft);
        }
      }
    });
  }, [isShowHeader]);

  const onScroll = useCallback((e) => {
    const { offsetHeight, scrollTop: contentScrollTop } = rowsContainer.current;

    // Calculate the start rendering row index, and end rendering row index
    const start = Math.max(0, Math.floor(contentScrollTop / CARD_ITEM_HEIGHT) - RENDER_MORE_NUMBER);
    const end = Math.min(Math.ceil((contentScrollTop + rowsContainer.current.offsetHeight) / CARD_ITEM_HEIGHT) + RENDER_MORE_NUMBER, rowsCount);

    if (Math.abs(start - startRenderIndex) > 5 || start < 5) {
      setStartRenderIndex(start);
    }
    if (Math.abs(end - endRenderIndex) > 5 || end > rowsCount - 5) {
      setEndRenderIndex(end);
    }
    // Scroll to the bottom of the page, load more rows
    if (offsetHeight + contentScrollTop >= rowsContainer.current.scrollHeight) {
      loadMore && loadMore();
    }
  }, [startRenderIndex, endRenderIndex, rowsCount]);

  const updateScrollTop = useCallback((highlightIndex, step = 0) => {
    if (!rowsContainer.current) return;
    if (highlightIndex === -1) return;
    const { offsetHeight, scrollTop: contentScrollTop } = rowsContainer.current;
    const start = Math.ceil(contentScrollTop / CARD_ITEM_HEIGHT);
    const end = Math.floor((contentScrollTop + offsetHeight) / CARD_ITEM_HEIGHT) - 1;
    if (start <= highlightIndex && highlightIndex <= end) return;
    rowsContainer.current.scrollTop = contentScrollTop + step * CARD_ITEM_HEIGHT;
  }, []);

  const initRowDom = useCallback((rowId, rowRef) => {
    rowsDom.current[rowId] = rowRef;
  }, []);

  const removeRowDom = useCallback((rowId) => {
    delete rowsDom.current[rowId];
  }, []);

  const handleRowClick = useCallback((row) => {
    if (mode === 'add' || mode === 'remove') {
      const rowId = row._id;
      let newSelectedRowIds = selectedRowIds.slice(0);
      if (isMultipleSelect) {
        const rowIndex = newSelectedRowIds.findIndex(id => id === rowId);
        if (rowIndex === -1) {
          newSelectedRowIds.push(rowId);
        } else {
          newSelectedRowIds.splice(rowIndex, 1);
        }
      } else {
        newSelectedRowIds = [rowId];
      }
      updateSelectedRowIds(newSelectedRowIds);
      return;
    }
    onRowClick && onRowClick(row);
  }, [isMultipleSelect, selectedRowIds, mode, updateSelectedRowIds, onRowClick]);

  const handleRowStatusClick = useCallback((row) => {
    const newSelectedRowIds = selectedRowIds.filter(id => id !== row._id);
    updateSelectedRowIds(newSelectedRowIds);
  }, [selectedRowIds, updateSelectedRowIds]);

  useEffect(() => {
    const onHotKey = (event) => {
      switch (event.keyCode) {
        case KeyCodes.LeftArrow:
        case KeyCodes.RightArrow: {
          event.stopPropagation();
          event.preventDefault();
          break;
        }
        case KeyCodes.UpArrow: {
          event.stopPropagation();
          event.preventDefault();
          setHighlightIndex(pre => {
            const nextHighlightIndex = pre === 0 ? 0 : pre - 1;
            updateScrollTop(nextHighlightIndex, -1);
            return nextHighlightIndex;
          });
          break;
        }
        case KeyCodes.DownArrow: {
          event.stopPropagation();
          event.preventDefault();
          setHighlightIndex(pre => {
            const nextHighlightIndex = pre === rowsCount - 1 ? rowsCount - 1 : pre + 1;
            updateScrollTop(nextHighlightIndex, 1);
            return nextHighlightIndex;
          });
          break;
        }
        // case KeyCodes.Enter: {
        //   this.onEnter(e);
        //   break;
        // }
        default: {
          break;
        }
      }
    };

    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [rowsCount]);

  const renderColumns = columns.filter(c => c.key !== titleColumnKey);

  return (
    <div className="sea-metadata-card-container">
      {isShowHeader && (
        <Header
          ref={headerRef}
          columns={renderColumns}
          canResize={canResize}
          isShowScrollBtn={isShowScrollBtn}
          scrollLeft={scrollLeft}
          setItemScrollLeft={setItemScrollLeft}
          setScrollLeft={setScrollLeft}
          modifyColumnWidth={modifyColumnWidth}
        />
      )}
      <div className="sea-metadata-card-body" ref={rowsContainer} onScroll={onScroll}>
        <div className="sea-metadata-card-rows">
          {startRenderIndex > 0 && (<div style={{ height: startRenderIndex * CARD_ITEM_HEIGHT }}></div>)}
          {rows.slice(startRenderIndex, endRenderIndex).map((row, index) => {
            return (
              <Row
                row={row}
                columns={columns}
                isSelected={selectedRowIds.includes(row._id)}
                mode={mode}
                renderColumns={renderColumns}
                titleColumnKey={titleColumnKey}
                initRowDom={initRowDom}
                scrollLeft={scrollLeft}
                highlight={highlightIndex === (index + startRenderIndex)}
                metadata={metadata}
                removeRowDom={removeRowDom}
                setItemScrollLeft={setItemScrollLeft}
                onClick={handleRowClick}
                onStatusClick={handleRowStatusClick}
              />
            );
          })}
          {(rowsCount - endRenderIndex) > 0 && (
            <div style={{ height: (rowsCount - endRenderIndex) * CARD_ITEM_HEIGHT - 10 }}></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Main;
