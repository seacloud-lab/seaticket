import React, { useCallback, useMemo, useRef, useState } from 'react';
import { toKeyCode } from 'is-hotkey';
import toaster from '@/components/toaster';
import TableMain from './table-main';
import { Utils } from '@/utils/utils';
import { isModZ, isModShiftZ } from '@/utils/hotkey';
import { getValidGroupbys } from '../../utils/group';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER, MAX_LOAD_NUMBER } from '../../constants';
import context from '../../context';
import { useMetadata, useCollaborators, useTagsData } from '../../hooks';

import './index.css';

const Table = ({ expandRow }) => {
  const [isLoadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef(null);

  const {
    isLoading,
    metadata,
    store,
    modifyRows,
    deleteRows,
    modifyRow,
    modifyRowTags,
    renameColumn,
    deleteColumn,
    modifyColumnData,
    modifyColumnOrder,
    modifyColumnWidth,
    createContextMenuOptions,
    insertColumn,
  } = useMetadata();

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

  }, [metadata, store]);

  const loadAll = useCallback(async (maxLoadNumber, callback) => {
    if (!metadata.hasMore) return;
    setLoadingMore(true);
    const rowsCount = metadata.row_ids.length;
    const loadNumber = rowsCount % MAX_LOAD_NUMBER !== 0 ? MAX_LOAD_NUMBER - rowsCount % MAX_LOAD_NUMBER : MAX_LOAD_NUMBER;
    try {
      await store.loadMore(loadNumber);
      setLoadingMore(false);
    } catch (error) {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
      setLoadingMore(false);
      return;
    }
    if (store.data.hasMore && store.data.row_ids.length < maxLoadNumber) {
      loadAll(maxLoadNumber, callback);
    } else {
      typeof callback === 'function' && callback(store.data.hasMore);
      setLoadingMore(false);
    }
  }, [metadata, store]);

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
    if (!window.seaTableBody || !window.seaTableBody.getGroupRowByIndex) return null;
    const groupRow = window.seaTableBody.getGroupRowByIndex(groupRowIndex);
    const rowId = groupRow.rowId;
    return rowId && rowGetterById(rowId);
  }, [rowGetterById]);

  const rowGetterByIndex = useCallback(({ isGroupView, groupRowIndex, rowIndex }) => {
    if (isGroupView) return groupRowGetter(groupRowIndex);
    return rowGetter(rowIndex);
  }, [groupRowGetter, rowGetter]);

  const getTableContentRect = useCallback(() => {
    return containerRef?.current?.getBoundingClientRect() || { x: 0, right: window.innerWidth };
  }, [containerRef]);

  return (
    <div className="sea-metadata-container sea-metadata-container-transform" ref={containerRef}>
      <TableMain
        isGroupView={isGroupView}
        isLoadingMore={isLoadingMore}
        loadMore={loadMore}
        metadata={metadata}
        tagsData={tagsData}
        collaborators={collaborators}
        modifyRow={modifyRow}
        modifyRowTags={modifyRowTags}
        modifyRows={modifyRows}
        deleteRows={deleteRows}
        rowGetterById={rowGetterById}
        rowGetterByIndex={rowGetterByIndex}
        getTableContentRect={getTableContentRect}
        getAdjacentRowsIds={getAdjacentRowsIds}
        loadAll={loadAll}
        insertColumn={insertColumn}
        renameColumn={renameColumn}
        deleteColumn={deleteColumn}
        modifyColumnData={modifyColumnData}
        modifyColumnWidth={modifyColumnWidth}
        modifyColumnOrder={modifyColumnOrder}
        onGridKeyDown={onHotKey}
        onGridKeyUp={onHotKeyUp}
        createContextMenuOptions={createContextMenuOptions}
        expandRow={expandRow}
      />
    </div>
  );
};

export default Table;
