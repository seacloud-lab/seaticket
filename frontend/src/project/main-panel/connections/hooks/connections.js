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

const ConnectionsContext = React.createContext(null);

export const ConnectionsProvider = ({ projectUuid, children }) => {
  const [isLoading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [isShowRecordDialog, setIsShowRecordDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);

  const loadTime = useRef(new Date());
  const pageRef = useRef(1);
  const pageCountRef = useRef(1000);
  const hasMoreRef = useRef(true);
  const activeConnectionRef = useRef(null);
  const isConnectionsLoaded = useRef(false);

  const modifyLocalConnectionRecord = useCallback((connectionId, update) => {
    setConnections(prev => prev.map(record =>
      record.id === connectionId ? { ...record, ...update } : record
    ));
  }, []);

  const modifyLocalConnectionSyncStatus = useCallback((update) => {
    setConnections(prev => prev.map(record => update[record.id] ?
      ({ ...record, status: { ...record.status, last_sync_status: update[record.id] } }) : record
    ));
  }, []);

  const modifyConnectionStatus = useCallback((connectionId, update) => {
    connectionsAPI.updateConnectionStatus(projectUuid, connectionId, update).then(() => {
      modifyLocalConnectionRecord(connectionId, update);
      if (Object.keys(update).includes('is_active')) {
        toaster.success(update.is_active ? gettext('Activated') : gettext('Deactivated'));
      }
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, [modifyLocalConnectionRecord]);

  const closeConnectionDialog = useCallback(() => {
    setIsShowRecordDialog(false);
  }, []);

  const createConnection = useCallback(({ type, name, config }, resetSubmittingState, isShowRecordDialog = false, callback) => {
    connectionsAPI.createConnection(projectUuid, { type, name, config }).then(res => {
      const connection = new Connection(res.data.record);
      const newConnections = [...connections, connection];
      setConnections(newConnections);
      setIsShowRecordDialog(isShowRecordDialog);
      callback && callback(connection);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [connections]);

  const deleteConnectionRecord = useCallback(() => {
    connectionsAPI.deleteConnection(projectUuid, activeConnectionRef.current.id).then(res => {
      const activeConnectionIndex = connections.findIndex(c => c.id === activeConnectionRef.current.id);
      let newConnections = connections.slice(0);
      if (activeConnectionIndex > -1) {
        newConnections.splice(activeConnectionIndex, 1);
      }
      activeConnectionRef.current = null;
      setConnections(newConnections);
      setIsShowConfirmDialog(false);
      activeConnectionRef.current = null;
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsShowConfirmDialog(false);
      activeConnectionRef.current = null;
    });
  }, [connections]);

  const closeDeleteConfirmDialog = useCallback(() => {
    setIsShowConfirmDialog(false);
  }, []);

  const handleDelete = useCallback((record) => {
    activeConnectionRef.current = record;
    setIsShowConfirmDialog(true);
  }, []);

  const modifyConnection = useCallback(({ name, config }, resetSubmittingState, recordId) => {
    const activeRecordId = recordId || activeConnectionRef.current.id;
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
      setIsShowRecordDialog(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [connections]);

  const handleModify = useCallback((record) => {
    activeConnectionRef.current = record;
    setIsShowRecordDialog(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    if (isLoading) return;
    setLoading(true);
    connectionsAPI.listConnections(projectUuid, pageRef.current, pageCountRef.current).then(res => {
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
      isConnectionsLoaded.current = true;
      setConnections(newConnections);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [isLoading, projectUuid]);

  const load = useCallback(() => {
    if (!hasMoreRef.current) return;
    if (isConnectionsLoaded.current) return;
    if (isLoading) return;
    loadMore();
  }, [isLoading, loadMore]);

  const reloadConnections = useCallback(() => {
    const currentTime = new Date();
    if (isConnectionsLoaded.current && dayjs(currentTime).diff(loadTime.current, 'hours') < 1) return;
    loadTime.current = currentTime;
    pageRef.current = 1;
    hasMoreRef.current = true;
    isConnectionsLoaded.current = false;
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribeNewConnection = eventBus.subscribe(EVENT_BUS_TYPE.NEW_CONNECTION, () => {
      activeConnectionRef.current = null;
      setIsShowRecordDialog(true);
    });
    return () => {
      unsubscribeNewConnection();
    };
  }, []);

  return (
    <ConnectionsContext.Provider value={{
      isConnectionsLoaded: isConnectionsLoaded.current,
      isLoading,
      connections,
      modifyLocalConnectionRecord,
      modifyLocalConnectionSyncStatus,
      modifyConnectionStatus,
      handleDelete,
      handleModify,
      load,
      reloadConnections,
      loadMore,
    }}>
      {children}
      {isShowRecordDialog && (
        <>
          {activeConnectionRef.current ?
            <ModifyConnectionDialog
              record={activeConnectionRef.current}
              onToggle={closeConnectionDialog}
              onSubmit={modifyConnection}
            />
            :
            <NewConnectionDialog
              onToggle={closeConnectionDialog}
              onSubmit={createConnection}
              modifyConnection={modifyConnection}
            />
          }
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
