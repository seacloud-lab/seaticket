import React, { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toKeyCode } from 'is-hotkey';
import toaster from '@/components/toaster';
import TableMain from './table-main';
import { Utils } from '@/utils/utils';
import { isFunction } from '@/utils/type-detection';
import { isModZ, isModShiftZ } from '@/utils/hotkey';
import { getValidGroupbys } from '../../utils/group';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '../../constants';
import context from '../../context';
import { useMetadata, useCollaborators, useTagsData, useSelectedRows } from '../../hooks';

import './index.css';

const Table = ({ fixedColumnCount, expandRow, children }) => {
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [isShowRowExpand, setIsShowRowExpand] = useState(false);

  const expandRowRef = useRef(null);
  const containerRef = useRef(null);

  const {
    isLoading,
    metadata,
    store,
    insertRow,
    deleteRow,
    deleteRows,
    deleteLocalRows,
    modifyRow,
    modifyRows,
    modifyRowByRowExpand,
    modifyRowTags,
    renameColumn,
    deleteColumn,
    modifyColumnData,
    modifyColumnOrder,
    modifyColumnWidth,
    createContextMenuOptions,
    insertColumn,
    updateLocalRow,
  } = useMetadata();
  const { updateSelectedRowIds } = useSelectedRows();

  const { tagsData } = useTagsData();

  const { collaborators } = useCollaborators();

  const canModify = useMemo(() => context.canModify(), [context]);

  const focusDataGrid = useCallback(() => {
    setTimeout(() => context.eventBus.dispatch(EVENT_BUS_TYPE.FOCUS_CANVAS), 0);
  }, [context]);

  const onHotKey = useCallback((event) => {
    if (event.keyCode === toKeyCode('mod+shift')) return;
    if (event.target.className.includes('sea-metadata-editor-main')) return;

    const activeElement = document.activeElement;
    if (!containerRef.current.contains(activeElement)) return;

    if (isModZ(event)) {
      event.preventDefault();
      if (!canModify) return;
      store.undoOperation();
      focusDataGrid();
    } else if (isModShiftZ(event)) {
      event.preventDefault();
      if (!canModify) return;
      store.redoOperation();
      focusDataGrid();
    }
  }, [canModify, store, focusDataGrid]);

  const onHotKeyUp = useCallback((event) => {
    if (event.target.className.includes('sea-metadata-editor-main')) return;
  }, []);

  const isGroupView = useMemo(() => {
    if (isLoading || !metadata) return false;
    const validGroupbys = getValidGroupbys(metadata.view.groupbys, metadata.columns);
    return validGroupbys.length > 0;
  }, [isLoading, metadata]);

  const loadMore = useCallback(async () => {
    if (!metadata.hasMore) return;
    if (isLoadingMore) return;
    setLoadingMore(true);

    try {
      await store.loadMore(PER_LOAD_NUMBER);
      setLoadingMore(false);
    } catch (error) {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
      setLoadingMore(false);
      return;
    }

  }, [isLoadingMore, metadata, store]);

  const getAdjacentRowsIds = useCallback((rowIds) => {
    const rowIdsLen = metadata.row_ids.length;
    let rowIdsInOrder = [];
    let upperRowIds = [];
    let belowRowIds = [];
    let rowIdMap = {};
    rowIds.forEach(rowId => rowIdMap[rowId] = rowId);
    metadata.row_ids.forEach((rowId, index) => {
      if (!rowIdMap[rowId]) {
        return;
      }
      const upperRowId = index === 0 ? null : metadata.row_ids[index - 1];
      const belowRowId = index === rowIdsLen - 1 ? null : metadata.row_ids[index + 1];
      rowIdsInOrder.push(rowId);
      upperRowIds.push(upperRowId);
      belowRowIds.push(belowRowId);
    });
    return { rowIdsInOrder, upperRowIds, belowRowIds };
  }, [metadata]);

  const rowGetterById = useCallback((rowId) => {
    return metadata.id_row_map[rowId];
  }, [metadata]);

  const rowGetter = useCallback((rowIndex) => {
    const rowId = metadata.view.rows[rowIndex];
    return rowId && rowGetterById(rowId);
  }, [metadata, rowGetterById]);

  const groupRowGetter = useCallback((groupRowIndex) => {
    if (!window.seaMetadataBody || !window.seaMetadataBody.getGroupRowByIndex) return null;
    const groupRow = window.seaMetadataBody.getGroupRowByIndex(groupRowIndex);
    const rowId = groupRow.rowId;
    return rowId && rowGetterById(rowId);
  }, [rowGetterById]);

  const rowGetterByIndex = useCallback(({ isGroupView, groupRowIndex, rowIndex }) => {
    if (isGroupView) return groupRowGetter(groupRowIndex);
    return rowGetter(rowIndex);
  }, [groupRowGetter, rowGetter]);

  const getTableContentRect = useCallback(() => {
    return containerRef?.current?.getBoundingClientRect() || { x: 0, right: window.innerWidth, width: 0 };
  }, [containerRef?.current]);

  const onRowExpand = useCallback((row) => {
    if (isFunction(expandRow)) {
      expandRow(row);
      return;
    }
    expandRowRef.current = row || null;
    setIsShowRowExpand(true);
  }, [expandRow, children]);

  const closeRowExpand = useCallback(() => {
    expandRowRef.current = null;
    setIsShowRowExpand(false);
  }, []);

  useEffect(() => {
    const expandRowSubscribe = context.eventBus.subscribe(EVENT_BUS_TYPE.EXPAND_ROW, (row = null) => {
      expandRowRef.current = row;
      setIsShowRowExpand(true);
    });
    return () => {
      expandRowSubscribe();
    };
  }, []);

  return (
    <>
      <div className="sea-metadata-container sea-metadata-container-transform" ref={containerRef}>
        <TableMain
          isGroupView={isGroupView}
          isLoadingMore={isLoadingMore}
          isShowRowExpandBtn={Boolean(expandRow)}
          fixedColumnCount={fixedColumnCount}
          loadMore={loadMore}
          metadata={metadata}
          tagsData={tagsData}
          collaborators={collaborators}
          modifyRow={modifyRow}
          modifyRowTags={modifyRowTags}
          modifyRows={modifyRows}
          deleteRow={deleteRow}
          deleteRows={deleteRows}
          deleteLocalRows={deleteLocalRows}
          rowGetterById={rowGetterById}
          rowGetterByIndex={rowGetterByIndex}
          getTableContentRect={getTableContentRect}
          getAdjacentRowsIds={getAdjacentRowsIds}
          insertColumn={insertColumn}
          renameColumn={renameColumn}
          deleteColumn={deleteColumn}
          modifyColumnData={modifyColumnData}
          modifyColumnWidth={modifyColumnWidth}
          modifyColumnOrder={modifyColumnOrder}
          onGridKeyDown={onHotKey}
          onGridKeyUp={onHotKeyUp}
          createContextMenuOptions={createContextMenuOptions}
          onRowExpand={onRowExpand}
          updateSelectedRowIds={updateSelectedRowIds}
          updateLocalRow={updateLocalRow}
        />
      </div>
      {isShowRowExpand && isValidElement(children) && (
        <>
          {cloneElement(children, {
            row: expandRowRef.current,
            onToggle: closeRowExpand,
            onSubmit: expandRowRef.current ? (...params) => modifyRowByRowExpand(expandRowRef.current._id, ...params) : insertRow
          })}
        </>
      )}
    </>
  );
};

export default Table;
