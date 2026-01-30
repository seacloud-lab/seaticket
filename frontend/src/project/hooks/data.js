import React, { useCallback, useContext, useState } from 'react';
import dcopy from 'deep-copy';
import { CollaboratorsProvider } from '@/sea-metadata';
import { EMPTY_TABLE } from '../constants';
import { shouldReload } from '../utils';
import { TICKET_TABLE_NAME } from '../main-panel/tickets/constants';
import { ConnectionsProvider } from '../main-panel/connections/hooks';
import { AIChatToolsProvider } from '../main-panel/ask/hooks';
import { AnalyzeTaskProvider } from '../main-panel/analyze/hooks/analyze-task';
import { MetadataProvider } from '../main-panel/tickets/hooks';
import ObjectUtils, { hasOwnProperty } from '@/utils/object-utils';
import { NotificationProvider } from '@/components/common/notification/hooks/notification';
import projectAPI from '../api/project-api';
import userAPI from '@/api/user-api';
import { TagsProvider } from '../main-panel/tags/hooks/tags';

const DataContext = React.createContext(null);

export const DataProvider = ({ projectUuid, activeBar, children }) => {
  const [data, setData] = useState({ version: 0 });

  const updateData = useCallback((data) => {
    data.version = data.version + 1;
    setData(data);
  }, []);

  const getTableByName = useCallback((tableName, defaultTable = dcopy(EMPTY_TABLE)) => {
    if (!tableName) return defaultTable;
    return data[tableName] || defaultTable;
  }, [data]);

  const deleteTableByName = useCallback((tableName) => {
    if (!tableName) return;
    if (!data[tableName]) return;
    let newData = dcopy(data);
    delete newData[tableName];
    updateData(newData);
  }, [data, updateData]);

  const updateTable = useCallback((tableName, update = {}, defaultTable = dcopy(EMPTY_TABLE)) => {
    if (!tableName) return;
    setData(data => {
      const newData = dcopy(data);
      let table = newData[tableName] || defaultTable;
      newData[tableName] = { ...table, ...update };
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const markTablesViewExpired = useCallback((tableNames, callback) => {
    if (!Array.isArray(tableNames) || tableNames.length === 0) return;
    setData(data => {
      const newData = dcopy(data);
      tableNames.forEach(tableName => {
        const table = newData[tableName];
        if (table) {
          const id_view_map = { ...table.id_view_map };
          Object.keys(id_view_map).forEach(viewID => {
            const view = id_view_map[viewID];
            id_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
          });
          newData[tableName].id_view_map = id_view_map;
        }
      });
      newData.version = newData.version + 1;
      setTimeout(() => callback && callback(), 0);
      return newData;
    });
  }, []);

  const getTableViews = useCallback((tableName, api, isBuiltIn = false) => {
    if (isBuiltIn) return api();
    const table = getTableByName(tableName);
    let func = () => api().then(res => {
      let old_id_view_map = table.id_view_map;
      const { navigation, views } = res.data;
      let id_view_map = {};
      Array.isArray(views) && views.forEach(v => {
        const oldView = old_id_view_map[v._id] || {};
        const viewCompareKeys = ['filters', 'filter_conjunction', 'basic_filters', 'sorts'];
        let oldViewData = {};
        let newViewData = {};
        viewCompareKeys.forEach(key => {
          oldViewData[key] = oldView[key];
          newViewData[key] = v[key];
        });
        let newView = { ...oldView, ...v };
        if (!ObjectUtils.isSameObject(oldViewData, newViewData)) {
          newView.timestamp = 0;
          newView.rows = [];
        }
        id_view_map[v._id] = newView;
      });
      updateTable(tableName, { navigation, id_view_map, timestamp: Date.now() });
      return res;
    });
    if (table?.timestamp && !shouldReload(table?.timestamp)) {
      func = () => new Promise((resolve, reject) => {
        const { id_view_map, navigation } = table;
        resolve({
          data: { views: Object.values(id_view_map), navigation }
        });
      });
    }
    return func();
  }, [getTableByName, updateTable]);

  const getTableView = useCallback((tableName, viewID, api, isBuiltIn = false) => {
    if (isBuiltIn) return api();
    const table = getTableByName(tableName);
    const currentView = table.id_view_map[viewID];
    let func = () => api().then(res => {
      const { view } = res.data;
      let { id_view_map = {} } = table;
      id_view_map[viewID] = { ...id_view_map[viewID], ...view };
      updateTable(tableName, { id_view_map });
      return res;
    });
    if (currentView && !shouldReload(currentView.timestamp)) {
      func = () => new Promise((resolve, reject) => {
        resolve({
          data: { view: { ...currentView, rows: [] } }
        });
      });
    }
    return func();
  }, [getTableByName, updateTable]);

  const insertView = useCallback((tableName, api) => {
    return api().then(res => {
      const table = data[tableName] || null;
      if (table) {
        const view = res.data.view;
        let navigation = table.navigation.slice(0);
        navigation.push({ _id: view._id, type: 'view' });
        let id_view_map = { ...table.id_view_map };
        id_view_map[view._id] = view;
        updateTable(tableName, { id_view_map, navigation });
      }
      return res;
    });
  }, [data, updateData]);

  const deleteView = useCallback((tableName = '', viewID = '', api) => {
    return api().then(res => {
      const table = data[tableName] || null;
      if (table) {
        let navigation = table.navigation.slice(0);
        const navigationIndex = navigation.findIndex(v => v._id === viewID);
        navigation.splice(navigationIndex, 1);
        let id_view_map = { ...table.id_view_map };
        delete id_view_map[viewID];
        updateTable(tableName, { navigation, id_view_map });
      }
      return res;
    });
  }, [data, updateTable]);

  const modifyView = useCallback((tableName = '', viewID = '', viewData = {}, api, isBuiltIn = false) => {
    const table = data[tableName] || null;
    if (table) {
      const viewMapName = isBuiltIn ? 'built_in_view_map' : 'id_view_map';
      const viewDataKeys = Object.keys(viewData);
      let view_map = { ...table[viewMapName] };
      let newView = view_map[viewID] || {};
      newView = { ...newView, ...viewData };
      if (viewDataKeys.includes('sorts') || viewDataKeys.join('').toLowerCase().includes('filter')) {
        newView.timestamp = 0;
        newView.rows = [];
      }
      view_map[viewID] = newView;
      updateTable(tableName, { [viewMapName]: view_map });
    }
    return api();
  }, [data, updateTable]);

  const moveView = useCallback((tableName, sourceViewID, targetViewID, api) => {
    return api().then(res => {
      const table = data[tableName] || null;
      if (table) {
        let navigation = table.navigation.slice(0);
        const sourceViewIndex = navigation.findIndex(n => n._id === sourceViewID);
        const targetViewIndex = navigation.findIndex(n => n._id === targetViewID);
        const targetView = navigation[targetViewIndex];
        const sourceView = navigation[sourceViewIndex];
        navigation.splice(sourceViewIndex, 1);
        const newTargetViewIndex = navigation.findIndex(n => n._id === targetView._id);
        navigation.splice(newTargetViewIndex, 0, sourceView);
        updateTable(tableName, { navigation });
      }
      return res;
    });
  }, [data, updateTable]);

  const clearViewRows = useCallback((tableName = '', viewID = '', api, isBuiltIn = false) => {
    return api().then(res => {
      const table = data[tableName] || null;
      if (table) {
        const viewMapName = isBuiltIn ? 'built_in_view_map' : 'id_view_map';
        let viewMap = { ...table[viewMapName] };
        let newView = viewMap[viewID] || {};
        newView.rows = [];
        viewMap[viewID] = newView;
        updateTable(tableName, { [viewMapName]: viewMap });
      }
      return res;
    });
  }, [data, updateTable]);

  const duplicateView = useCallback((tableName, api) => {
    return api().then(res => {
      let table = data[tableName] ? dcopy(data[tableName]) : null;
      if (table) {
        const view = res.data.view;
        let navigation = table.navigation.slice(0);
        navigation.push({ _id: view._id, type: 'view' });
        let id_view_map = { ...table.id_view_map };
        id_view_map[view._id] = view;
        table.navigation = navigation;
        table.id_view_map = id_view_map;
        data[tableName] = table;
        updateData(data);
      }
      return res;
    });
  }, [data, updateData]);

  const getMetadata = useCallback((tableName, { view_id, start, is_reload = false }, api, isBuiltIn = false) => {
    let table = getTableByName(tableName);
    const viewMapName = isBuiltIn ? 'built_in_view_map' : 'id_view_map';
    const view = table[viewMapName][view_id] || {};
    let recordsName = 'records';
    if (tableName === TICKET_TABLE_NAME) {
      recordsName = TICKET_TABLE_NAME;
    }

    let func = () => api().then(res => {
      const records = res.data[recordsName];
      const rows = Array.isArray(records) ? records : [];
      const columns = res?.data?.columns || [];
      let rowIds = is_reload ? [] : [...(view?.rows || [])];
      let id_row_map = { ...table.id_row_map };
      let key_column_map = { ...table.key_column_map };
      let view_map = { ...table[viewMapName] };
      rows.forEach(r => {
        const rowId = String(r._pk);
        if (!rowIds.includes(rowId)) {
          rowIds.push(rowId);
        }
        id_row_map[rowId] = { ...id_row_map[rowId], ...r };
      });
      columns.forEach(c => {
        key_column_map[c.key] = c;
      });
      view_map[view_id] = { ...view, rows: rowIds, columns: columns.map(c => c.key), timestamp: Date.now() };
      updateTable(tableName, { id_row_map, key_column_map, [viewMapName]: view_map });
      return res;
    });
    if (!is_reload && view && start < view?.rows?.length && !shouldReload(view.timestamp)) {
      func = () => new Promise((resolve, reject) => {
        resolve({
          data: {
            [recordsName]: view.rows.map(rId => table.id_row_map[rId]).filter(Boolean),
            columns: view.columns.map(cKey => table.key_column_map[cKey]).filter(Boolean),
          }
        });
      });
    }
    return func();
  }, [getTableByName, updateTable]);

  const getRow = useCallback((tableName, rowId, api) => {
    if (!tableName || !rowId) return null;
    const rowIdString = rowId + '';
    const table = data[tableName];
    if (!table) return null;
    const id_row_map = table.id_row_map || {};
    return id_row_map[rowIdString];
  }, [data]);

  const modifyLocalRows = useCallback((tableName, rowsUpdate = []) => {
    if (!tableName) return;
    if (!Array.isArray(rowsUpdate) || rowsUpdate.length === 0) return;
    let table = getTableByName(tableName);
    let id_row_map_update = {};
    rowsUpdate.forEach(rowUpdate => {
      const { row_id, row } = rowUpdate;
      const rowIdString = row_id + '';
      const oldRow = table.id_row_map[rowIdString] || {};
      let oldValue = {};
      Object.keys(row).forEach((key) => {
        oldValue[key] = oldRow[key];
      });
      if (!ObjectUtils.isSameObject(oldValue, row)) {
        id_row_map_update[rowIdString] = { ...oldRow, ...row };
      }
    });
    if (Object.keys(id_row_map_update).length === 0) return;
    updateTable(tableName, { id_row_map: { ...table.id_row_map, ...id_row_map_update } });
  }, [getTableByName, updateTable]);

  const modifyLocalRow = useCallback((tableName, rowId, rowUpdate) => {
    modifyLocalRows(tableName, [{ row_id: rowId, row: rowUpdate }]);
  }, [modifyLocalRows]);

  const modifyRow = useCallback((tableName, rowId, rowUpdate, api) => {
    return api().then(res => {
      modifyLocalRow(tableName, rowId, rowUpdate);
      return res;
    });
  }, [modifyLocalRow]);

  const modifyRows = useCallback((tableName, rowsUpdate = [], api) => {
    return api().then(res => {
      modifyLocalRows(tableName, rowsUpdate);
      return res;
    });
  }, [modifyLocalRows]);

  const updateDataByDeleteRows = useCallback((tableName, rowIds = []) => {
    if (!tableName) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    const rowIdsString = rowIds.map(r => r + '');
    setData(data => {
      const newData = dcopy(data);
      const table = newData[tableName];
      if (!table) return data;
      let id_row_map = { ...table.id_row_map };
      rowIdsString.forEach(rowId => {
        delete id_row_map[rowId];
      });
      table.id_row_map = id_row_map;

      if (hasOwnProperty(table, 'id_view_map')) {
        let id_view_map = { ...table.id_view_map };
        Object.keys(id_view_map).forEach(viewID => {
          let view = id_view_map[viewID];
          if (view.timestamp && !shouldReload(view.timestamp) && hasOwnProperty(view, 'rows')) {
            let rows = Array.isArray(view.rows) ? view.rows : [];
            rows = rows.slice(0).filter(rId => !rowIdsString.includes(rId));
            view.rows = rows;
            id_view_map[viewID] = view;
          }
        });
        table.id_view_map = id_view_map;
      }
      if (hasOwnProperty(table, 'built_in_view_map')) {
        let built_in_view_map = { ...table.built_in_view_map };
        Object.keys(built_in_view_map).forEach(viewID => {
          let view = built_in_view_map[viewID];
          if (view.timestamp && !shouldReload(view.timestamp) && hasOwnProperty(view, 'rows')) {
            if (viewID !== 'trash') {
              let rows = Array.isArray(view.rows) ? view.rows : [];
              rows = rows.slice(0).filter(rId => !rowIdsString.includes(rId));
              view.rows = rows;
              built_in_view_map[viewID] = view;
            } else {
              built_in_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
            }
          }
        });
        table.built_in_view_map = built_in_view_map;
      }
      newData[tableName] = table;
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const deleteRow = useCallback((tableName, rowId, api) => {
    return api().then(res => {
      updateDataByDeleteRows(tableName, [rowId]);
      return res;
    });
  }, [updateDataByDeleteRows]);

  const deleteRows = useCallback((tableName, rowIds = [], api) => {
    return api().then(res => {
      updateDataByDeleteRows(tableName, rowIds);
      return res;
    });
  }, [updateDataByDeleteRows]);

  const insertRow = useCallback((tableName, rowId = '', rowData = null) => {
    if (!tableName) return;
    setData(data => {
      let isChanged = false;
      const newData = dcopy(data);
      const table = newData[tableName];
      if (!table) return data;
      if (rowId) {
        table.id_row_map[rowId + ''] = rowData;
      }
      if (hasOwnProperty(table, 'id_view_map')) {
        let id_view_map = { ...table.id_view_map };
        Object.keys(id_view_map).forEach(viewID => {
          let view = id_view_map[viewID];
          if (view && view.timestamp) {
            isChanged = true;
            id_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
          }
        });
        table.id_view_map = id_view_map;
      }
      if (hasOwnProperty(table, 'built_in_view_map')) {
        let built_in_view_map = { ...table.built_in_view_map };
        Object.keys(built_in_view_map).forEach(viewID => {
          let view = built_in_view_map[viewID];
          if (viewID !== 'trash') {
            if (view && view.timestamp) {
              isChanged = true;
              built_in_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
            }
          }
        });
        table.built_in_view_map = built_in_view_map;
      }
      if (!isChanged) return data;
      newData[tableName] = table;
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const restoreRows = useCallback((tableName, rowIds = []) => {
    if (!tableName) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    const rowIdsString = rowIds.map(r => r + '');
    setData(data => {
      const newData = dcopy(data);
      const table = newData[tableName];
      if (!table) return data;
      if (hasOwnProperty(table, 'id_view_map')) {
        let id_view_map = { ...table.id_view_map };
        Object.keys(id_view_map).forEach(viewID => {
          let view = id_view_map[viewID];
          id_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
        });
        table.id_view_map = id_view_map;
      }
      if (hasOwnProperty(table, 'built_in_view_map')) {
        let built_in_view_map = { ...table.built_in_view_map };
        Object.keys(built_in_view_map).forEach(viewID => {
          const view = built_in_view_map[viewID];
          if (viewID !== 'trash') {
            built_in_view_map[viewID] = { ...view, timestamp: 0, rows: [] };
          } else {
            let rows = Array.isArray(view.rows) ? view.rows : [];
            rows = rows.slice(0).filter(rId => !rowIdsString.includes(rId));
            view.rows = rows;
            built_in_view_map[viewID] = view;
          }
        });
        table.built_in_view_map = built_in_view_map;
      }
      newData[tableName] = table;
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const listUserInfo = useCallback((...params) => {
    return userAPI.listUserInfo(...params);
  }, []);

  const getCollaborators = useCallback(() => {
    return projectAPI.listProjectRelatedUsers(projectUuid);
  }, [projectUuid]);

  return (
    <DataContext.Provider value={{
      data,
      updateData,
      markTablesViewExpired,
      getTableByName,
      deleteTableByName,
      updateTable,
      getTableViews,
      getTableView,
      insertView,
      deleteView,
      modifyView,
      moveView,
      duplicateView,
      clearViewRows,

      getMetadata,
      getRow,
      insertRow,
      modifyRow,
      modifyLocalRow,
      modifyRows,
      modifyLocalRows,
      deleteRow,
      deleteRows,
      restoreRows,
    }}>
      <AIChatToolsProvider>
        <NotificationProvider projectUuid={projectUuid} activeBar={activeBar}>
          <CollaboratorsProvider listUserInfo={listUserInfo} getCollaborators={getCollaborators}>
            <TagsProvider projectUuid={projectUuid}>
              <MetadataProvider projectUuid={projectUuid}>
                <ConnectionsProvider projectUuid={projectUuid} >
                  <AnalyzeTaskProvider>
                    {children}
                  </AnalyzeTaskProvider>
                </ConnectionsProvider>
              </MetadataProvider>
            </TagsProvider>
          </CollaboratorsProvider>
        </NotificationProvider>
      </AIChatToolsProvider>
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('\'DataContext\' is null');
  }
  return context;
};
