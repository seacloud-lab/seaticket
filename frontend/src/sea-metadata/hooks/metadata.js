/* eslint-disable react/prop-types */
import React, { useContext, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useCollaborators } from './collaborators';
import context from '../context';
import Store from '../store';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '../constants';
import toaster from '@/components/toaster';
import { Utils } from '@/utils/utils';
import { getRowById, getRowsByIds } from '../utils/row';
import { isModF } from '@/utils/hotkey';
import { useSelectedRows } from './selected-rows';
import { isFunction } from '@/utils/type-detection';

const MetadataContext = React.createContext(null);

export const MetadataProvider = forwardRef(({
  viewID,
  api,
  tagsData,
  typesData,
  localStorageNamePrefix,
  createContextMenuOptions,
  cascadeUpdateCells,
  columnOrderRules,
  columnWidthRules,
  t,
  dataDidMount,
  children,
  ...params
}, ref) => {
  const [isLoading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({ rows: [], columns: [], view: {} });
  const [errorMessage, setErrorMessage] = useState(null);

  const storeRef = useRef(null);

  const { collaborators, collaboratorsCache } = useCollaborators();
  const { updateSelectedRowIdsByDelete } = useSelectedRows();

  const tableChanged = useCallback(() => {
    setMetadata(storeRef.current.data);
  }, []);

  const handleTableError = useCallback((error) => {
    toaster.danger(error.error);
  }, []);

  const updateMetadata = useCallback((data) => {
    setMetadata(data);
  }, []);

  const reloadMetadata = useCallback((isShowLoading = true) => {
    if (!storeRef.current?.data) return;
    if (isShowLoading) {
      setLoading(true);
      setErrorMessage('');
    }
    storeRef.current.reload(Math.max(storeRef.current.data.rows.length, PER_LOAD_NUMBER)).then(() => {
      setMetadata(storeRef.current.data);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      setErrorMessage(errorMsg);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const recalculateData = useCallback(() => {
    if (!storeRef.current?.data) return;
    setLoading(true);
    setErrorMessage('');
    storeRef.current.recalculate().then(() => {
      setMetadata(storeRef.current.data);
      setLoading(false);
    }).catch(error => {
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
    if (!storeRef.current?.data) return;
    storeRef.current.updateDataAttribute(update, isReplace).then(() => {
      setMetadata(storeRef.current.data);
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
    storeRef.current.modifyLocalRow(rowId, update);
  }, [storeRef]);

  const updateLocalRows = useCallback((updates) => {
    storeRef.current.modifyLocalRows(updates);
  }, [storeRef]);

  const updateLocalColumnData = useCallback((columnKey, newData, oldData) => {
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
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  }, [metadata, storeRef, cascadeUpdateCells]);

  const deleteRow = useCallback((rowId, { success_callback, fail_callback } = {}) => {
    storeRef.current.deleteRow(rowId, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        toaster.success(context.translate('{Row} deleted'));
        success_callback && success_callback();
      },
    });
  }, [metadata, storeRef]);

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
  }, [updateSelectedRowIdsByDelete]);

  const deleteLocalRows = useCallback((rowIds, { success_callback, fail_callback } = {}) => {
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

  const moveRow = () => {
    // todo
  };

  const duplicateRow = () => {
    // todo
  };

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
    if (isModF(event) && (!event.target || event.target.className.indexOf('modal') < 0)) {
      event.preventDefault();
      context.eventBus && context.eventBus.dispatch(EVENT_BUS_TYPE.START_SEARCH_ROWS);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    storeRef.current.tagsData = tagsData;
  }, [isLoading, tagsData]);

  useEffect(() => {
    if (isLoading) return;
    storeRef.current.typesData = typesData;
  }, [isLoading, typesData]);

  useEffect(() => {
    if (isLoading) return;
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
      localStorageName: `${localStorageNamePrefix}-${viewID}`,
    });
    storeRef.current = new Store({ viewId: viewID, typesData, tagsData, columnOrderRules, columnWidthRules, dataDidMount });
    storeRef.current.initStartIndex();
    storeRef.current.load(PER_LOAD_NUMBER).then(() => {
      if (!isCancelled) {
        setMetadata(storeRef.current.data);
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
      storeRef.current.destroy();
    };
  }, [localStorageNamePrefix, viewID]);

  useEffect(() => {
    const eventBus = context.eventBus;
    const unsubscribeServerTableChanged = eventBus.subscribe(EVENT_BUS_TYPE.SERVER_DATA_CHANGED, tableChanged);
    const unsubscribeTableChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_DATA_CHANGED, tableChanged);
    const unsubscribeHandleTableError = eventBus.subscribe(EVENT_BUS_TYPE.TABLE_ERROR, handleTableError);
    const unsubscribeUpdateRows = eventBus.subscribe(EVENT_BUS_TYPE.UPDATE_TABLE_ROWS, updateMetadata);
    const unsubscribeReloadData = eventBus.subscribe(EVENT_BUS_TYPE.RELOAD_DATA, reloadMetadata);
    const unsubscribeRecalculateData = eventBus.subscribe(EVENT_BUS_TYPE.RECALCULATE_DATA, recalculateData);
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
      unsubscribeLocalRowChanged();
      unsubscribeLocalRowsChanged();
      unsubscribeLocalColumnChanged();
      unsubscribeMoveRow();
      unsubscribeLoading();
      unsubscribeClearData();
      unsubscribeUpdateDataAttribute();
    };
  }, [tableChanged, handleTableError, updateMetadata, reloadMetadata, recalculateData, updateLocalRow, updateLocalRows, updateLocalColumnData, moveRow, clearData, updateDataAttribute]);

  useImperativeHandle(ref, () => ({
    getData: () => metadata,
  }), [metadata]);

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
