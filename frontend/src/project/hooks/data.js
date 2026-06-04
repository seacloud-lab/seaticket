import React, { useCallback, useContext, useState } from 'react';
import deepcopy from 'deep-copy';
import _ from 'lodash';
import { CollaboratorsProvider } from '@/sea-metadata';
import { EMPTY_TABLE } from '../constants';
import { shouldReload } from '../utils';
import { PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME } from '../main-panel/tickets/constants';
import { ConnectionsProvider } from '../main-panel/connections/hooks';
import { AIChatToolsProvider } from '../main-panel/ask/hooks';
import { AnalyzeTaskProvider } from '../main-panel/analyze/hooks/analyze-task';
import { MetadataProvider } from '../main-panel/tickets/hooks';
import { PortalIssuesMetadataProvider } from '../main-panel/portal-issues/hooks';
import ObjectUtils, { hasOwnProperty } from '@/utils/object-utils';
import { NotificationProvider } from '@/components/common/notification/hooks/notification';
import projectAPI from '../api/project-api';
import userAPI from '@/api/user-api';
import { TagsProvider } from '../main-panel/tags/hooks/tags';
import { KB_TABLE_NAME } from '../main-panel/knowledge-base/constants';
import { isFunction } from '@/utils/type-detection';
import { convertRowToKeyValue } from '@/sea-metadata/utils/row';

const DataContext = React.createContext(null);

export const DataProvider = ({
  projectUuid,
  projectName,
  workspaceID,
  activeBar,
  api,
  enablePortal,
  children
}) => {
  const [data, setData] = useState({ version: 0 });

  const updateData = useCallback((data) => {
    data.version = data.version + 1;
    setData(data);
  }, []);

  const getTableByName = useCallback((tableName, defaultTable = deepcopy(EMPTY_TABLE)) => {
    if (!tableName) return defaultTable;
    return data[tableName] || defaultTable;
  }, [data]);

  const deleteTableByName = useCallback((tableName) => {
    if (!tableName) return;
    if (!data[tableName]) return;
    let newData = deepcopy(data);
    delete newData[tableName];
    updateData(newData);
  }, [data, updateData]);

  const updateTable = useCallback((tableName, update = {}, defaultTable = deepcopy(EMPTY_TABLE)) => {
    if (!tableName) return;
    setData(data => {
      const newData = deepcopy(data);
      let table = newData[tableName] || defaultTable;
      newData[tableName] = { ...table, ...update };
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const markTablesViewExpired = useCallback((tableNames, callback) => {
    if (!Array.isArray(tableNames) || tableNames.length === 0) return;
    setData(data => {
      const newData = deepcopy(data);
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
      return newData;
    });
    setTimeout(() => callback && callback(), 0);
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
      setData(data => {
        const newData = deepcopy(data);
        let table = newData[tableName];
        if (!table) return data;
        const viewMapName = isBuiltIn ? 'built_in_view_map' : 'id_view_map';
        let viewMap = { ...table[viewMapName] };
        let newView = viewMap[viewID] || {};
        newView.rows = [];
        viewMap[viewID] = newView;
        newData[tableName] = { ...table, [viewMapName]: viewMap };

        // update other table's view
        Object.keys(newData).forEach(tName => {
          if (![TICKET_TABLE_NAME, KB_TABLE_NAME, 'version'].includes(tName)) {
            let table = newData[tName];
            if (hasOwnProperty(table, 'linked_records') && Object.keys(table.linked_records).length > 0) {
              let id_view_map = { ...table.id_view_map };
              Object.keys(id_view_map).forEach(viewID => {
                let view = id_view_map[viewID];
                view.rows = [];
                view.timestamp = 0;
                id_view_map[viewID] = view;
              });
              table.linked_records = {};
              table.id_view_map = id_view_map;
              newData[tName] = table;
            }
          }
        });
        newData.version = newData.version + 1;
        return newData;
      });
      return res;
    });
  }, [data, updateTable]);

  const duplicateView = useCallback((tableName, api) => {
    return api().then(res => {
      let table = data[tableName] ? deepcopy(data[tableName]) : null;
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

  const getMetadata = useCallback((tableName, { view_id, start, limit, is_reload = false }, api, isBuiltIn = false) => {
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
      const linkedRecords = res?.data?.linked_records || {};
      const relatedUsers = res?.data?.related_users || [];
      const columns = res?.data?.columns || [];
      let rowIds = is_reload ? [] : [...(view?.rows || [])];
      let id_row_map = { ...table.id_row_map };
      let key_column_map = { ...table.key_column_map };
      let linked_records = { ...table.linked_records, ...linkedRecords };
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
      view_map[view_id] = {
        ...view,
        rows: rowIds,
        columns: columns.map(c => c.key),
        timestamp: Date.now(),
        has_more: rows.length >= limit,
      };
      setData(data => {
        const newData = deepcopy(data);
        let _table = newData[tableName] || deepcopy(EMPTY_TABLE);
        newData[tableName] = { ..._table, id_row_map, key_column_map, [viewMapName]: view_map, linked_records, related_users: relatedUsers };

        if (tableName !== TICKET_TABLE_NAME && tableName !== KB_TABLE_NAME && data[TICKET_TABLE_NAME]) {
          const ticketTable = newData[TICKET_TABLE_NAME];
          const titleColumn = Object.values(ticketTable?.key_column_map || {}).find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TITLE);
          if (titleColumn) {
            Object.keys(linkedRecords).forEach(ticketKey => {
              const ticket = ticketTable.id_row_map[ticketKey + ''] || {};
              ticketTable.id_row_map[ticketKey + ''] = { ...ticket, [titleColumn.key]: linkedRecords[ticketKey] };
            });
            newData[TICKET_TABLE_NAME] = ticketTable;
          }
        }

        newData.version = newData.version + 1;
        return newData;
      });
      return _.merge(res, { data: { has_more: rows.length >= limit } });
    });

    if (!is_reload && view && start < view?.rows?.length && !shouldReload(view.timestamp)) {
      func = () => new Promise((resolve, reject) => {
        if (tableName !== TICKET_TABLE_NAME && tableName !== KB_TABLE_NAME && data[TICKET_TABLE_NAME]) {
          const ticketTable = data[TICKET_TABLE_NAME];
          const titleColumn = Object.values(ticketTable?.key_column_map || {}).find(c => c.name === PREDEFINED_TICKET_COLUMN_NAME.TITLE);
          if (titleColumn) {
            Object.keys(table.linked_records).forEach(ticketKey => {
              const value = table.linked_records[ticketKey];
              const ticket = ticketTable.id_row_map[ticketKey + ''] || {};
              table.linked_records[ticketKey] = ticket[titleColumn.key] || value;
            });
          }
        }

        resolve({
          data: {
            [recordsName]: view.rows.map(rId => table.id_row_map[rId]).filter(Boolean),
            columns: view.columns.map(cKey => table.key_column_map[cKey]).filter(Boolean),
            linked_records: table.linked_records,
            has_more: view.has_more,
            related_users: table?.related_users || [],
          }
        });
      });
    }
    return func();
  }, [getTableByName]);

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
    let table = data[tableName];
    if (!table) return;
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
  }, [data, updateTable]);

  const modifyLocalRow = useCallback((tableName, rowId, rowUpdate) => {
    modifyLocalRows(tableName, [{ row_id: rowId, row: rowUpdate }]);
  }, [modifyLocalRows]);

  const modifyTablesRows = useCallback((updates = [], isNeedConvertKeyValue = false) => {
    if (!Array.isArray(updates) || updates.length === 0) return;

    const _updateTableData = (data, tableUpdate) => {
      const { name = '', rows = [] } = tableUpdate || {};
      let table = data[name];
      if (table) {
        const columns = Object.values(table?.key_column_map || {});
        const idRowMap = table.id_row_map;
        let _id_row_map = {};
        Array.isArray(rows) && rows.forEach(rowUpdate => {
          const { row_id, row: rowData } = rowUpdate;
          const row = isNeedConvertKeyValue ? convertRowToKeyValue(rowData, { data: { columns } }) : rowData;
          const oldRow = idRowMap[row_id];
          _id_row_map[row_id] = { ...oldRow, ...row };
        });

        data[name] = {
          ...table,
          id_row_map: { ...idRowMap, ..._id_row_map },
        };
      }
    };

    setData(data => {
      const newData = deepcopy(data);
      updates.forEach(tableUpdate => {
        _updateTableData(newData, tableUpdate);
      });
      newData.version = newData.version + 1;
      return newData;
    });
  }, []);

  const modifyRow = useCallback((tableName, rowId, rowUpdate, api, { typesData } = {}) => {
    return api().then(res => {
      let table = data[tableName];
      let _rowUpdate = { ...rowUpdate };
      if (table) {
        if (res?.data?.row) {
          const columns = Object.values(table?.key_column_map || {});
          const rowUpdateCallback = convertRowToKeyValue(res.data.row, { data: { columns }, typesData });
          _rowUpdate = { ...rowUpdate, ...rowUpdateCallback };
        }
        modifyLocalRow(tableName, rowId, _rowUpdate);
      }
      return {
        data: {
          'row': _rowUpdate,
        },
      };
    });
  }, [data, modifyLocalRow]);

  const modifyRowLink = useCallback((table1Update, table2Update, api) => {
    const _updateTableData = (data, tableUpdate) => {
      const { tableName = '', rowId = '', rowUpdate = {}, linkedRecords = {} } = tableUpdate || {};

      let table = data[tableName];
      if (table) {
        const idRowMap = table.id_row_map;
        const oldRow = idRowMap[rowId];
        let rowData = rowUpdate;
        if (tableName === TICKET_TABLE_NAME) {
          const key = Object.keys(rowUpdate)[0];
          const oldValue = oldRow[key] || [];
          const addedValue = rowUpdate[key] || [];
          const newValue = [...oldValue, ...addedValue];
          rowData[key] = newValue;
        }
        data[tableName] = {
          ...table,
          id_row_map: { ...idRowMap, [rowId]: { ...oldRow, ...rowData } },
          linked_records: { ...table.linked_records, ...linkedRecords },
        };
      }
    };

    return api().then(res => {
      setData(data => {
        const newData = deepcopy(data);
        _updateTableData(newData, table1Update);
        _updateTableData(newData, table2Update);
        newData.version = newData.version + 1;
        return newData;
      });
      return res;
    });
  }, []);

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
      const newData = deepcopy(data);
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

  const initDataWithInsertRow = useCallback((data, tableName) => {
    let isChanged = false;
    const newData = deepcopy(data);
    const table = newData[tableName];
    if (!table) return data;
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
  }, []);

  const insertRow = useCallback((tableName) => {
    if (!tableName) return;
    setData(data => initDataWithInsertRow(data, tableName));
  }, [initDataWithInsertRow]);

  const insertRowByLink = useCallback((linkedTableName, tableName, linkedRecord, rowId, rowData, callback) => {
    if (!linkedTableName || !tableName) return;
    setData(data => {
      let newData = initDataWithInsertRow(data, linkedTableName);
      let table = newData[tableName];
      if (table) {
        table.linked_records = { ...table.linked_records, ...linkedRecord };
        const rowIdString = rowId + '';
        const row = table.id_row_map[rowIdString];
        table.id_row_map[rowIdString] = { ...row, ...rowData };
        newData[tableName] = table;

        if (data.version !== newData.version) {
          newData.version = newData.version + 1;
        }
      }
      setTimeout(() => callback && callback(), 0);
      return newData;
    });
  }, [initDataWithInsertRow]);

  const restoreRows = useCallback((tableName, rowIds = []) => {
    if (!tableName) return;
    if (!Array.isArray(rowIds) || rowIds.length === 0) return;
    const rowIdsString = rowIds.map(r => r + '');
    setData(data => {
      const newData = deepcopy(data);
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
    if (isFunction(api?.listUserInfo)) {
      return api.listUserInfo(...params);
    }
    return userAPI.listUserInfo(...params);
  }, [api]);

  const getCollaborators = useCallback(() => {
    if (isFunction(api?.listProjectRelatedUsers)) {
      return api.listProjectRelatedUsers(projectUuid);
    }
    return projectAPI.listProjectRelatedUsers(projectUuid);
  }, [projectUuid, api]);

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
      insertRowByLink,
      modifyRow,
      modifyRowLink,
      modifyLocalRow,
      modifyRows,
      modifyLocalRows,
      deleteRow,
      deleteRows,
      restoreRows,
      modifyTablesRows,
    }}>
      <AIChatToolsProvider>
        <NotificationProvider projectUuid={projectUuid} activeBar={activeBar}>
          <CollaboratorsProvider listUserInfo={listUserInfo} getCollaborators={getCollaborators}>
            <TagsProvider projectUuid={projectUuid} api={api}>
              <MetadataProvider projectUuid={projectUuid} api={api}>
                <ConnectionsProvider projectUuid={projectUuid} api={api}>
                  <PortalIssuesMetadataProvider projectUuid={projectUuid} enablePortal={enablePortal}>
                    <AnalyzeTaskProvider>
                      {children}
                    </AnalyzeTaskProvider>
                  </PortalIssuesMetadataProvider>
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
