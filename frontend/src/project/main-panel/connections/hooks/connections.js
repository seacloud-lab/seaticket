import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import { CommonOperationConfirmationDialog, toaster } from '@/components';
import { Connection } from '../models';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';
import NewConnectionDialog from '../components/new-connection-dialog';
import ModifyConnectionDialog from '../components/modify-connection-dialog';
import { connectionsAPI } from '../../../api';
import { useData } from '@/project/hooks';
import { getTableName, initConnectionStatus } from '../utils';
import { CONNECTION_SYNC_STATUS } from '../constants';
import ObjectUtils from '@/utils/object-utils';
import { isFunction } from '@/utils/type-detection';

const ConnectionsContext = React.createContext(null);

export const ConnectionsProvider = ({ projectUuid, api = connectionsAPI, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [connections, setConnections] = useState([]);
  const [isShowConnectionDialog, setShowConnectionDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);

  const { deleteTableByName, markTablesViewExpired } = useData();

  const getUrlParams = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams;
  }, []);

  const updateUrlParams = useCallback((params) => {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === '') {
        searchParams.delete(key);
      } else {
        searchParams.set(key, value);
      }
    });
    const newUrl = url.toString();
    window.history.replaceState(null, '', newUrl);
  }, []);

  const toggleConnectionDialog = useCallback((show) => {
    const newShow = typeof show === 'boolean' ? show : !isShowConnectionDialog;
    setShowConnectionDialog(newShow);
    updateUrlParams({
      'connection-dialog': newShow ? 'open' : null
    });
  }, [isShowConnectionDialog, updateUrlParams]);

  useEffect(() => {
    const urlParams = getUrlParams();
    const dialogParam = urlParams.get('connection-dialog');
    if (dialogParam === 'open' && !isShowConnectionDialog) {
      setShowConnectionDialog(true);
    }
  }, [getUrlParams]);

  const pageRef = useRef(1);
  const pageCountRef = useRef(1000);
  const hasMoreRef = useRef(true);
  const activeConnectionRef = useRef(null);
  const loadTime = useRef(new Date());

  const deleteConnection = useCallback((connectionID) => {
    const activeConnectionIndex = connections.findIndex(c => c.id === Number(connectionID));
    let newConnections = connections.slice(0);
    let connection;
    if (activeConnectionIndex > -1) {
      connection = newConnections[activeConnectionIndex];
      newConnections.splice(activeConnectionIndex, 1);
    }
    setConnections(newConnections);

    const connectionTableName = getTableName(connection);
    deleteTableByName(connectionTableName);
  }, [connections, deleteTableByName]);

  const modifyLocalConnectionRecord = useCallback((connectionId, update) => {
    setConnections(prev => prev.map(record =>
      record.id === connectionId ? { ...record, ...update } : record
    ));
  }, []);

  const modifyLocalConnectionsSyncStatus = useCallback((update = {}, callback) => {
    setConnections(connections => connections.map(connection => {
      const connectionUpdate = update[connection.id];
      if (!connectionUpdate) return connection;
      const status = initConnectionStatus(connectionUpdate?.status);
      const newConnection = { ...connection, status, last_sync_time: connectionUpdate?.last_sync_time || '' };
      if (ObjectUtils.isSameObject(newConnection, connection)) return connection;
      if (status?.last_sync_status === CONNECTION_SYNC_STATUS.COMPLETED) {
        const tableName = getTableName(newConnection);
        markTablesViewExpired([tableName], callback);
      }
      return newConnection;
    }));
  }, [markTablesViewExpired]);

  const modifyConnectionIsActiveStatus = useCallback((connectionId, activeStatus) => {
    const update = { 'is_active': activeStatus };
    connectionsAPI.updateConnectionStatus(projectUuid, connectionId, update).then(() => {
      modifyLocalConnectionRecord(connectionId, update);
      toaster.success(activeStatus ? gettext('Activated') : gettext('Deactivated'));
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [modifyLocalConnectionRecord]);

  const closeConnectionDialog = useCallback(() => {
    toggleConnectionDialog(false);
  }, []);

  const createConnection = useCallback(({ type, name, config }, resetSubmittingState, isShowConnectionDialog = false, callback) => {
    connectionsAPI.createConnection(projectUuid, { type, name, config }).then(res => {
      const connection = new Connection(res.data.record);
      const newConnections = [...connections, connection];
      setConnections(newConnections);
      toggleConnectionDialog(isShowConnectionDialog);
      callback && callback(connection);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [connections]);

  const deleteConnectionRecord = useCallback(() => {
    connectionsAPI.deleteConnection(projectUuid, activeConnectionRef.current.id).then(res => {
      deleteConnection(activeConnectionRef.current.id);
      activeConnectionRef.current = null;
      setIsShowConfirmDialog(false);
      activeConnectionRef.current = null;
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsShowConfirmDialog(false);
      activeConnectionRef.current = null;
    });
  }, [deleteConnection]);

  const closeDeleteConfirmDialog = useCallback(() => {
    setIsShowConfirmDialog(false);
  }, []);

  const handleDelete = useCallback((record) => {
    activeConnectionRef.current = record;
    setIsShowConfirmDialog(true);
  }, []);

  const modifyConnection = useCallback(({ name, config }, resetSubmittingState, recordId) => {
    let activeRecordId = recordId || activeConnectionRef.current.id;
    activeRecordId = Number(activeRecordId);
    connectionsAPI.modifyConnection(projectUuid, activeRecordId, { name, config }).then(res => {
      const activeConnectionIndex = connections.findIndex(c => c.id === activeRecordId);
      const newConnection = new Connection(res.data.record);
      let newConnections = connections.slice(0);
      if (activeConnectionIndex === -1) {
        newConnections.push(newConnection);
      } else {
        newConnections[activeConnectionIndex] = newConnection;
      }
      setConnections(newConnections);
      activeConnectionRef.current = null;
      toggleConnectionDialog(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [connections]);

  const handleModify = useCallback((record) => {
    activeConnectionRef.current = record;
    toggleConnectionDialog(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    if (pageRef.current > 1 && isLoadingMore) return;
    if (pageRef.current > 1) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    if (!isFunction(api?.listConnections)) {
      setLoadingMore(false);
      setLoading(false);
      return;
    }

    api.listConnections(projectUuid, pageRef.current, pageCountRef.current).then(res => {
      const moreConnections = res.data.records.map(r => new Connection(r));
      let newConnections = pageRef.current === 1 ? [] : connections.slice(0);
      let recordsMap = newConnections.reduce((pre, cur) => {
        if (pre[cur.id]) return pre;
        pre[cur.id] = true;
        return pre;
      }, {});
      if (moreConnections.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      moreConnections.forEach(connection => {
        if (!recordsMap[connection.id]) {
          newConnections.push(connection);
        }
      });
      setConnections(newConnections);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setLoading(false);
      setLoadingMore(false);
    });
  }, [isLoadingMore, projectUuid]);

  const reloadConnections = useCallback(() => {
    const currentTime = new Date();
    if (!isLoading && dayjs(currentTime).diff(loadTime.current, 'hours') < 1) return;
    loadTime.current = currentTime;
    pageRef.current = Math.ceil((connections?.length || 0) / pageCountRef.current) || 1;
    hasMoreRef.current = true;
    loadMore();
  }, [isLoading, loadMore]);

  useEffect(() => {
    const unsubscribeNewConnection = eventBus.subscribe(EVENT_BUS_TYPE.NEW_CONNECTION, () => {
      activeConnectionRef.current = null;
      toggleConnectionDialog(true);
    });
    return () => {
      unsubscribeNewConnection();
    };
  }, [toggleConnectionDialog]);

  useEffect(() => {
    if (!isLoading) return;
    loadMore();
  }, [isLoading, loadMore]);

  return (
    <ConnectionsContext.Provider value={{
      isLoading,
      isLoadingMore,
      connections,
      modifyLocalConnectionRecord,
      modifyLocalConnectionsSyncStatus,
      modifyConnectionIsActiveStatus,
      handleDelete,
      handleModify,
      reloadConnections,
      loadMore,
    }}>
      {children}
      {isShowConnectionDialog && (
        <>
          {activeConnectionRef.current ? (
            <ModifyConnectionDialog
              record={activeConnectionRef.current}
              onToggle={closeConnectionDialog}
              onSubmit={modifyConnection}
            />
          ) : (
            <NewConnectionDialog
              onToggle={closeConnectionDialog}
              onSubmit={createConnection}
              modifyConnection={modifyConnection}
            />
          )}
        </>
      )}
      {isShowConfirmDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Delete')}
          message={gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', activeConnectionRef.current.name)}
          executeOperation={deleteConnectionRecord}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDeleteConfirmDialog}
        />
      )}
    </ConnectionsContext.Provider>
  );
};

export const useConnections = () => {
  const context = useContext(ConnectionsContext);
  if (!context) {
    throw new Error('\'ConnectionsContext\' is null');
  }
  return context;
};
