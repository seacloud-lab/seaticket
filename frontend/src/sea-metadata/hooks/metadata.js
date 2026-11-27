/* eslint-disable react/prop-types */
import React, { useContext, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import deepCopy from 'deep-copy';
import { isEqual } from 'lodash';
import toaster from '@/components/toaster';
import { isModF } from '@/utils/hotkey';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '../constants';
import { useSeaMetadataContext } from '../context-provider';
import Store from '../store';
import { getRowById, getRowsByIds } from '../utils/row';
import { useCollaborators } from './collaborators';
import { useSelectedRows } from './selected-rows';

const MetadataContext = React.createContext(null);

export const MetadataProvider = forwardRef(({
  viewID,
  api,
  tagsData,
  typesData,
  customersData,
  localStorageNamePrefix,
  createContextMenuOptions,
  cascadeUpdateCells,
  columnOrderRules,
  columnWidthRules,
  notDisplayColumns,
  t,
  dataDidMount,
  shouldRemoveRowAfterUpdate,
  generatorRowClassName,
  children,
  ...params
}, ref) => {
  const context = useSeaMetadataContext();
  const [isLoading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({ rows: [], columns: [], view: {} });
  const [errorMessage, setErrorMessage] = useState(null);

  const storeRef = useRef(null);

  const { collaborators, collaboratorsCache } = useCollaborators();
  const { selectedRowIds, updateSelectedRowIdsByDelete } = useSelectedRows();

  const tableChanged = useCallback(() => {
    if (storeRef.current?.data) setMetadata(storeRef.current.data);
  }, []);

  const handleTableError = useCallback((error) => {
    toaster.danger(error.error);
  }, []);

  const updateMetadata = useCallback((data) => {
    setMetadata(data);
  }, []);

  const reloadMetadata = useCallback((isShowLoading = true) => {
    const store = storeRef.current;
    if (!store?.data) return;
    if (isShowLoading) {
      setLoading(true);
      setErrorMessage('');
    }
    store.reload(Math.max(store.data.rows.length, PER_LOAD_NUMBER)).then(() => {
      if (storeRef.current !== store) return;
      setMetadata(store.data);
    }).catch(error => {
      if (storeRef.current !== store) return;
      const errorMsg = Utils.getErrorMsg(error);
      setErrorMessage(errorMsg);
    }).finally(() => {
      if (storeRef.current !== store) return;
      setLoading(false);
    });
  }, []);

  const recalculateData = useCallback(() => {
    const store = storeRef.current;
    if (!store?.data) return;
    setLoading(true);
    setErrorMessage('');
    store.recalculate().then(() => {
      if (storeRef.current !== store) return;
      setMetadata(store.data);
      setLoading(false);
    }).catch(error => {
      if (storeRef.current !== store) return;
      const errorMsg = Utils.getErrorMsg(error);
      setErrorMessage(errorMsg);
      setLoading(false);
    });
  }, []);

  const clearData = useCallback(() => {
    if (!storeRef.current?.data) return;
    storeRef.current.clearData();
  }, []);

  const updateDataAttribute = useCallback((update, isReplace) => {
    const store = storeRef.current;
    if (!store?.data) return;
    store.updateDataAttribute(update, isReplace).then(() => {
      if (storeRef.current !== store) return;
      setMetadata(store.data);
    });
  }, []);

  const modifyFilters = useCallback((filters, filterConjunction, basicFilters) => {
    storeRef.current.modifyFilters(filterConjunction, filters, basicFilters);
  }, [storeRef]);

  const modifySorts = useCallback((sorts, displaySorts = false) => {
    storeRef.current.modifySorts(sorts, displaySorts);
  }, [storeRef]);

  const modifyGroupbys = useCallback((groupbys) => {
    storeRef.current.modifyGroupbys(groupbys);
  }, [storeRef]);

  const modifyRowColor = useCallback((colorbys) => {
    storeRef.current.modifyRowColor(colorbys);
  }, [storeRef]);

  const modifyRowHeight = useCallback((rowHeight) => {
    storeRef.current.modifyRowHeight(rowHeight);
  }, [storeRef]);

  const modifyHiddenColumns = useCallback((hiddenColumns) => {
    storeRef.current.modifyHiddenColumns(hiddenColumns);
  }, [storeRef]);

  const modifyViewLock = useCallback((isLocked) => {
    storeRef.current.modifyViewLock(isLocked);
  }, [storeRef]);

  const modifySettings = useCallback((settings) => {
    storeRef.current.modifySettings(settings);
  }, [storeRef]);

  const insertRow = useCallback((data, { success_callback, fail_callback } = {}) => {
    storeRef.current.insertRow(data, { success_callback, fail_callback });
  }, [storeRef]);

  const updateLocalRow = useCallback((rowId, update) => {
    if (!storeRef.current?.data) return;
    const rowUpdate = isFunction(update) ? update(getRowById(storeRef.current.data, rowId)) : update;
    storeRef.current.modifyLocalRow(rowId, rowUpdate);
  }, [storeRef]);

  const updateLocalRows = useCallback((updates) => {
    if (!storeRef.current?.data) return;
    storeRef.current.modifyLocalRows(updates);
  }, [storeRef]);

  const updateLocalColumnData = useCallback((columnKey, newData, oldData) => {
    if (!storeRef.current?.data) return;
    storeRef.current.modifyLocalColumnData(columnKey, newData, oldData);
  }, []);

  const modifyRows = useCallback((rowIds, idRowData, idOldRowOldData, isCopyPaste = false, { success_callback, fail_callback } = {}) => {
    const originalRows = getRowsByIds(metadata, rowIds);
    let validRowIds = [];
    let validIdRowUpdates = {};
    let validIdOldRowData = {};
    originalRows.forEach(row => {
      if (row && context.canModifyRow(row)) {
        const rowId = row._id;
        validRowIds.push(rowId);
        validIdRowUpdates[rowId] = idRowData[rowId];
        validIdOldRowData[rowId] = idOldRowOldData[rowId];
        isFunction(cascadeUpdateCells) && cascadeUpdateCells(metadata, rowId, validIdRowUpdates[rowId], validIdOldRowData[rowId], isCopyPaste);
      }
    });
    storeRef.current.modifyRows(validRowIds, validIdRowUpdates, validIdOldRowData, isCopyPaste, {
      fail_callback: (error) => {
        if (fail_callback && isFunction(fail_callback)) {
          fail_callback(error);
          return;
        }
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  }, [metadata, storeRef, cascadeUpdateCells, context]);

  const deleteRow = useCallback((rowId, { success_callback, fail_callback, row_data } = {}) => {
    storeRef.current.deleteRow(rowId, {
      row_data,
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        toaster.success(context.translate('{Row} deleted'));
        success_callback && success_callback();
      },
    });
  }, [storeRef, context]);

  const deleteRows = useCallback((rowIds, { success_callback, fail_callback } = {}) => {
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    storeRef.current.deleteRows(rowIds, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: (operation) => {
        const successRows = operation.success_rows;
        if (successRows.length === 1) {
          toaster.success(context.translate('{Row} deleted'));
        } else {
          toaster.success(context.translate('{Rows} deleted'));
        }
        success_callback && success_callback();
        updateSelectedRowIdsByDelete(successRows);
      },
    });
  }, [updateSelectedRowIdsByDelete, context]);

  const deleteLocalRows = useCallback((rowIds, { success_callback, fail_callback } = {}) => {
    if (!storeRef.current?.data) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    storeRef.current.deleteLocalRows(rowIds, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
        updateSelectedRowIdsByDelete(rowIds);
      },
    });
  }, [updateSelectedRowIdsByDelete]);

  const modifyRow = useCallback((rowId, updates, oldRowData, isCopyPaste, { success_callback, fail_callback } = {}) => {
    isFunction(cascadeUpdateCells) && cascadeUpdateCells(metadata, rowId, updates, oldRowData, isCopyPaste);
    storeRef.current.modifyRow(rowId, updates, oldRowData, isCopyPaste, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  }, [metadata, storeRef, cascadeUpdateCells]);

  const modifyRowByRowExpand = useCallback((rowId, rowUpdate, { success_callback, fail_callback } = {}) => {
    const row = getRowById(metadata, rowId);
    if (!row) return;
    let oldRowData = {};
    Object.keys(rowUpdate).forEach(key => {
      oldRowData[key] = row[key];
    });
    modifyRow(rowId, rowUpdate, oldRowData, false, { success_callback, fail_callback });
  }, [metadata, modifyRow]);

  const createMoreOptions = useCallback((row, { onRowChange } = {}) => {
    const store = storeRef.current;
    if (!row || !store?.data || !isFunction(createContextMenuOptions)) return [];
    const rowId = row._id;
    let previousRow = deepCopy(getRowById(store.data, rowId));
    const notifyRowChange = () => {
      if (storeRef.current !== store || !store.data) return;
      const currentRow = getRowById(store.data, rowId);
      const rowUpdate = {};
      Object.keys(currentRow || {}).forEach(key => {
        if (!isEqual(previousRow?.[key], currentRow[key])) rowUpdate[key] = currentRow[key];
      });
      previousRow = deepCopy(currentRow);
      if (isFunction(onRowChange) && (!currentRow || Object.keys(rowUpdate).length > 0)) {
        onRowChange({ rowUpdate, deleted: !currentRow, columns: store.data.columns });
      }
    };
    const run = callback => (...args) => {
      if (storeRef.current !== store) return;
      return callback(...args);
    };
    const withNotify = (callbacks = {}) => {
      let notified = false;
      return {
        ...callbacks,
        success_callback: (...args) => {
          // Store reuses success callbacks for undo/redo; notify only for the initial operation.
          if (!notified) {
            notified = true;
            notifyRowChange();
          }
          callbacks.success_callback && callbacks.success_callback(...args);
        },
      };
    };
    const options = createContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      rowMetrics: { idSelectedRowMap: {} },
      table: { ...store.data, id_row_map: { ...store.data.id_row_map, [rowId]: row } },
      rowGetterByIndex: () => row,
      context,
      hideMenu: () => {},
      modifyRow: run((id, update, oldData, isCopyPaste, callbacks) => modifyRow(id, update, oldData, isCopyPaste, withNotify(callbacks))),
      modifyRows: run((ids, updates, oldData, isCopyPaste, callbacks) => modifyRows(ids, updates, oldData, isCopyPaste, withNotify(callbacks))),
      deleteRow: run((id, callbacks) => deleteRow(id, { ...withNotify(callbacks), row_data: row })),
      deleteRows: run((ids, callbacks) => deleteRows(ids, withNotify(callbacks))),
      updateLocalRow: run((id, update) => { updateLocalRow(id, update); notifyRowChange(); }),
    }) || [];
    return options.map(option => !option?.callback ? option : {
      ...option,
      callback: run((...args) => {
        const result = option.callback(...args);
        // Some lists have their own asynchronous operations, such as mail trash.
        return result?.then ? result.then(value => { notifyRowChange(); return value; }) : result;
      }),
    });
  }, [createContextMenuOptions, modifyRow, modifyRows, deleteRow, deleteRows, updateLocalRow, context]);

  const moveRow = useCallback(() => {
    // todo
  }, []);

  const duplicateRow = useCallback(() => {
    // todo
  }, []);

  const renameColumn = useCallback((columnKey, newName, oldName) => {
    storeRef.current.renameColumn(columnKey, newName, oldName);
  }, [storeRef]);

  const deleteColumn = useCallback((columnKey, oldColumn) => {
    storeRef.current.deleteColumn(columnKey, oldColumn);
  }, [storeRef]);

  const modifyColumnData = useCallback((columnKey, newData, oldData, { optionModifyType } = {}) => {
    storeRef.current.modifyColumnData(columnKey, newData, oldData, { optionModifyType });
  }, [storeRef]);

  const modifyColumnWidth = useCallback((columnKey, newWidth) => {
    storeRef.current.modifyColumnWidth(columnKey, newWidth);
  }, [storeRef]);

  const modifyColumnOrder = useCallback((sourceColumnKey, targetColumnKey) => {
    storeRef.current.modifyColumnOrder(sourceColumnKey, targetColumnKey);
  }, [storeRef]);

  const insertColumn = useCallback((name, type, { key, data }) => {
    storeRef.current.insertColumn(name, type, { key, data });
  }, [storeRef]);

  const searchRows = useCallback((searchValue = '') => {
    storeRef.current.searchRows(searchValue);
  }, [storeRef]);

  const onKeydown = useCallback((event) => {
    if (event.defaultPrevented || !isModF(event) || !context.ownsSearchShortcut(event)) return;
    event.preventDefault();
    context.eventBus.dispatch(EVENT_BUS_TYPE.START_SEARCH_ROWS);
  }, [context]);

  useEffect(() => {
    if (isLoading || !storeRef.current) return;
    storeRef.current.tagsData = tagsData;
  }, [isLoading, tagsData]);

  useEffect(() => {
    if (isLoading || !storeRef.current) return;
    storeRef.current.typesData = typesData;
  }, [isLoading, typesData]);

  useEffect(() => {
    if (isLoading || !storeRef.current) return;
    storeRef.current.customersData = customersData;
  }, [isLoading, customersData]);

  useEffect(() => {
    if (isLoading || !storeRef.current) return;
    storeRef.current.collaborators = [...collaborators, ...Object.values(collaboratorsCache)];
  }, [isLoading, collaborators, collaboratorsCache]);

  useEffect(() => {
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
    };
  }, [onKeydown]);

  // init
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage('');
    context.re_set({
      localStorageName: context.storageName(localStorageNamePrefix, viewID),
      legacyLocalStorageName: context.useLegacyStorage ? `${localStorageNamePrefix}-${viewID}` : undefined,
    });
    storeRef.current = new Store({
      context, viewId: viewID, typesData, tagsData, customersData, columnOrderRules, columnWidthRules,
      notDisplayColumns, dataDidMount, shouldRemoveRowAfterUpdate,
      collaborators: [...collaborators, ...Object.values(collaboratorsCache)],
      // This notification outlives a view; stale Store callbacks still cannot
      // update selection, dialogs, or the replacement Store.
      onOperationError: error => toaster.danger(error),
    });
    const store = storeRef.current;
    store.initStartIndex();
    store.load(PER_LOAD_NUMBER).then(() => {
      if (!isCancelled) {
        if (storeRef.current?.data) setMetadata(storeRef.current.data);
        setLoading(false);
      }
    }).catch(error => {
      if (!isCancelled) {
        const errorMsg = Utils.getErrorMsg(error);
        setErrorMessage(errorMsg);
        setLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      store.destroy();
      if (storeRef.current === store) storeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorageNamePrefix, viewID, context]);

  useEffect(() => {
    const eventBus = context.eventBus;
    const unsubscribeServerTableChanged = eventBus.subscribe(EVENT_BUS_TYPE.SERVER_DATA_CHANGED, tableChanged);
    const unsubscribeTableChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_DATA_CHANGED, tableChanged);
    const unsubscribeHandleTableError = eventBus.subscribe(EVENT_BUS_TYPE.TABLE_ERROR, handleTableError);
    const unsubscribeUpdateRows = eventBus.subscribe(EVENT_BUS_TYPE.UPDATE_TABLE_ROWS, updateMetadata);
    const unsubscribeReloadData = eventBus.subscribe(EVENT_BUS_TYPE.RELOAD_DATA, reloadMetadata);
    const unsubscribeRecalculateData = eventBus.subscribe(EVENT_BUS_TYPE.RECALCULATE_DATA, recalculateData);
    const unsubscribeLocalRowDeleted = eventBus.subscribe(EVENT_BUS_TYPE.DELETE_ROWS, deleteLocalRows);
    const unsubscribeLocalRowChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, updateLocalRow);
    const unsubscribeLocalRowsChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_ROWS_CHANGED, updateLocalRows);
    const unsubscribeLocalColumnChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_COLUMN_DATA_CHANGED, updateLocalColumnData);
    const unsubscribeMoveRow = eventBus.subscribe(EVENT_BUS_TYPE.MOVE_ROW, moveRow);
    const unsubscribeLoading = eventBus.subscribe(EVENT_BUS_TYPE.LOADING, (loading = false) => {
      setLoading(loading);
      setErrorMessage('');
    });
    const unsubscribeClearData = eventBus.subscribe(EVENT_BUS_TYPE.CLEAR_DATA, clearData);
    const unsubscribeUpdateDataAttribute = eventBus.subscribe(EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, updateDataAttribute);

    return () => {
      unsubscribeServerTableChanged();
      unsubscribeTableChanged();
      unsubscribeHandleTableError();
      unsubscribeUpdateRows();
      unsubscribeReloadData();
      unsubscribeRecalculateData();
      unsubscribeLocalRowDeleted();
      unsubscribeLocalRowChanged();
      unsubscribeLocalRowsChanged();
      unsubscribeLocalColumnChanged();
      unsubscribeMoveRow();
      unsubscribeLoading();
      unsubscribeClearData();
      unsubscribeUpdateDataAttribute();
    };
  }, [tableChanged, handleTableError, updateMetadata, reloadMetadata, recalculateData, updateLocalRow, updateLocalRows, updateLocalColumnData, moveRow, clearData, updateDataAttribute, deleteLocalRows, context]);

  useImperativeHandle(ref, () => ({
    getData: () => metadata,
    getSelectedRowIds: () => selectedRowIds,
    createMoreOptions,
  }), [metadata, selectedRowIds, createMoreOptions]);

  return (
    <MetadataContext.Provider
      value={{
        ...params,
        isLoading,
        viewID,
        errorMessage,
        metadata,
        store: storeRef.current,
        modifySettings,
        modifyFilters,
        modifySorts,
        modifyGroupbys,
        modifyRowColor,
        modifyRowHeight,
        modifyHiddenColumns,
        modifyViewLock,
        insertRow,
        modifyRowByRowExpand,
        modifyRows,
        deleteRow,
        deleteRows,
        deleteLocalRows,
        modifyRow,
        moveRow,
        duplicateRow,
        searchRows,
        renameColumn,
        deleteColumn,
        modifyColumnOrder,
        modifyColumnData,
        modifyColumnWidth,
        insertColumn,
        updateLocalRow,
        createContextMenuOptions,
        generatorRowClassName,
      }}
    >
      {children}
    </MetadataContext.Provider>
  );
});

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error('\'MetadataContext\' is null');
  }
  return context;
};
