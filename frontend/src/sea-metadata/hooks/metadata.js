/* eslint-disable react/prop-types */
import React, { useContext, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useCollaborators } from './collaborators';
import context from '../context';
import Store from '../store';
import { EVENT_BUS_TYPE, PER_LOAD_NUMBER } from '../constants';
import toaster from '@/components/toaster';
import { Utils } from '@/utils/utils';
import { getRowById } from '../utils/row';
import { isModF } from '@/utils/hotkey';

const MetadataContext = React.createContext(null);

export const MetadataProvider = forwardRef(({
  viewID,
  api,
  tagsData,
  typesData,
  localStorageNamePrefix,
  createContextMenuOptions,
  t,
  children,
  ...params
}, ref) => {
  const [isLoading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({ rows: [], columns: [], view: {} });
  const [errorMessage, setErrorMessage] = useState(null);

  const storeRef = useRef(null);

  const { collaborators, collaboratorsCache } = useCollaborators();

  const tableChanged = useCallback(() => {
    setMetadata(storeRef.current.data);
  }, []);

  const handleTableError = useCallback((error) => {
    toaster.danger(error.error);
  }, []);

  const updateMetadata = useCallback((data) => {
    setMetadata(data);
  }, []);

  const reloadMetadata = useCallback(() => {
    if (!storeRef.current?.data) return;
    setLoading(true);
    storeRef.current.reload(PER_LOAD_NUMBER).then(() => {
      setMetadata(storeRef.current.data);
      setLoading(false);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      setErrorMessage(errorMsg);
      setLoading(false);
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

  const modifySettings = useCallback((settings) => {
    storeRef.current.modifySettings(settings);
  }, [storeRef]);

  const insertRow = useCallback((data, { success_callback, fail_callback } = {}) => {
    storeRef.current.insertRow(data, { success_callback, fail_callback });
  }, [storeRef]);

  const updateLocalRow = useCallback(({ rowId }, update) => {
    storeRef.current.modifyLocalRow({ row_id: rowId }, update);
  }, [storeRef]);

  const updateLocalColumnData = useCallback((columnKey, newData, oldData) => {
    storeRef.current.modifyLocalColumnData(columnKey, newData, oldData);
  }, []);

  const modifyRows = useCallback((rowIds, idRowUpdates, idOriginalRowUpdates, idOldRowData, idOriginalOldRowData, isCopyPaste = false, { success_callback, fail_callback } = {}) => {
    storeRef.current.modifyRows(rowIds, idRowUpdates, idOriginalRowUpdates, idOldRowData, idOriginalOldRowData, isCopyPaste, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  }, [metadata, storeRef]);

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

  const deleteRows = (rowsIds, { success_callback, fail_callback } = {}) => {
    if (!Array.isArray(rowsIds) || rowsIds.length === 0) return;
    storeRef.current.deleteRows(rowsIds, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        if (rowsIds.length === 1) {
          toaster.success(context.translate('{Row} deleted'));
        } else {
          toaster.success(context.translate('{Rows} deleted'));
        }
        success_callback && success_callback();
      },
    });
  };

  const modifyRowByRowExpand = (rowId, update, { success_callback, fail_callback } = {}) => {
    const updates = update;
    const originalUpdates = update;
    const row = getRowById(metadata, rowId);
    if (!row) return;
    let oldRowData = {};
    Object.keys(update).forEach(key => {
      oldRowData[key] = row[key];
    });
    storeRef.current.modifyRow(rowId, updates, oldRowData, originalUpdates, oldRowData, false, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  };

  const modifyRow = (rowId, updates, oldRowData, originalUpdates, originalOldRowData, isCopyPaste, { success_callback, fail_callback } = {}) => {
    storeRef.current.modifyRow(rowId, updates, oldRowData, originalUpdates, originalOldRowData, isCopyPaste, {
      fail_callback: (error) => {
        fail_callback && fail_callback(error);
        error && toaster.danger(error);
      },
      success_callback: () => {
        success_callback && success_callback();
      },
    });
  };

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
    context.re_set({
      localStorageName: `${localStorageNamePrefix}-${viewID}`,
    });
    storeRef.current = new Store({ viewId: viewID, typesData, tagsData });
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
    const unsubscribeLocalRowChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, updateLocalRow);
    const unsubscribeLocalColumnChanged = eventBus.subscribe(EVENT_BUS_TYPE.LOCAL_COLUMN_DATA_CHANGED, updateLocalColumnData);
    const unsubscribeMoveRow = eventBus.subscribe(EVENT_BUS_TYPE.MOVE_ROW, moveRow);
    const unsubscribeLoading = eventBus.subscribe(EVENT_BUS_TYPE.LOADING, (loading = false) => setLoading(loading));

    return () => {
      unsubscribeServerTableChanged();
      unsubscribeTableChanged();
      unsubscribeHandleTableError();
      unsubscribeUpdateRows();
      unsubscribeReloadData();
      unsubscribeLocalRowChanged();
      unsubscribeLocalColumnChanged();
      unsubscribeMoveRow();
      unsubscribeLoading();
    };
  }, [tableChanged, handleTableError, updateMetadata, reloadMetadata, updateLocalRow, updateLocalColumnData, moveRow]);

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
        insertRow,
        modifyRowByRowExpand,
        modifyRows,
        deleteRow,
        deleteRows,
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
