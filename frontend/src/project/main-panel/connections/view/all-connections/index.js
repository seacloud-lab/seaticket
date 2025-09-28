import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { connectionsAPI } from '../../../../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '@/components';
import ConnectionStatusDialog from '../../components/connection-status-dialog';
import createFormatter from '../../components/cell-formatter';
import { CONNECTION_FIELD_TYPE } from '../../constants';
import { useConnections, useConnectionsPage } from '../../hooks';
import { Connection } from '../../models';

import './index.css';

const AllConnections = ({ projectUuid }) => {
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);

  const activeRecordRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const pollingStartTimeRef = useRef(new Map());
  const POLLING_TIMEOUT = 30 * 60 * 1000;


  const { isLoading, isDataLoaded, connections, reload, loadMore, handleModify, handleDelete, modifyConnectionStatus, updateConnectionRecord } = useConnections();
  const { togglePageType, updatePageName } = useConnectionsPage();

  const columns = useMemo(() => {
    return [
      { key: 'name', name: gettext('Connection'), type: CONNECTION_FIELD_TYPE.CONNECTION_NAME, width: '30%' },
      { key: 'sync_status', name: gettext('Sync status'), type: CONNECTION_FIELD_TYPE.SYNC_STATUS, width: '20%' },
      { key: 'indexed_at', name: gettext('Last synced at'), type: CONNECTION_FIELD_TYPE.DATE, width: '20%' },
      { key: '', name: '', type: CONNECTION_FIELD_TYPE.EMPTY, width: '20%' },
      { key: 'op', name: '', type: CONNECTION_FIELD_TYPE.OP, width: '10%' }
    ].map(column => (
      {
        ...column,
        formatter: createFormatter(column)
      }
    ));
  }, []);

  const onMore = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowStatusDialog(true);
  }, []);

  const closeStatusDialog = useCallback(() => {
    activeRecordRef.current = null;
    setIsShowStatusDialog(false);
  }, []);

  const handleExpandRow = useCallback((row) => {
    updatePageName && updatePageName(row.name);
    togglePageType && togglePageType(row.id);
  }, [togglePageType]);

  const refreshConnection = useCallback((connectionId) => {
    if (!connectionId) return;
    return connectionsAPI.getConnection(projectUuid, connectionId)
      .then(res => {
        const newRecord = new Connection(res.data.record);
        updateConnectionRecord && updateConnectionRecord(connectionId, newRecord);
        return newRecord;
      })
      .catch((error) => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
      });
  }, [projectUuid, updateConnectionRecord]);

  const onManualSync = useCallback((record) => {
    const id = record?.id || activeRecordRef.current?.id;
    if (!id) return;
    connectionsAPI.triggerSync(projectUuid, id).then(() => {
      toaster.success(gettext('Sync task queued'));
      refreshConnection && refreshConnection(id);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      let error_msg = '';
      if (errorMessage.message_type === 'Manual sync too frequent') {
        const next_time = errorMessage.next_time ? dayjs(errorMessage.next_time).format('YYYY-MM-DD HH:mm:ss') : '--';
        error_msg = errorMessage.message_type + '. Next time:' + next_time;
      } else {
        error_msg = errorMessage;
      }
      toaster.danger(error_msg);
    });
  }, [projectUuid, refreshConnection]);

  const handleStatusActive = (status, row) => {
    const { is_active: oldStatus, id } = row;
    if (status === oldStatus) return;
    modifyConnectionStatus(id, { 'is_active': status });
  };

  useEffect(() => {
    reload();
  }, []);

  const getSyncStatus = useCallback((connection) => {
    const raw = connection?.status || '{}';
    const status = JSON.parse(raw);
    const syncStatus = status.last_sync_status || '';
    return syncStatus.toLowerCase();
  }, []);

  const isTerminalStatus = useCallback((statusStr) => {
    const s = statusStr.toLowerCase();
    return s === 'completed' || s === 'failed';
  }, []);

  const shouldStopPolling = useCallback((connectionId) => {
    const now = Date.now();
    const startTime = pollingStartTimeRef.current.get(connectionId);
    if (startTime && (now - startTime) > POLLING_TIMEOUT) return true;
    return false;
  }, []);

  const cleanupPollingRecord = useCallback((connectionId) => {
    pollingStartTimeRef.current.delete(connectionId);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    pollingStartTimeRef.current.clear();
  }, []);

  useEffect(() => {
    if (!connections || connections.length === 0) {
      stopPolling();
      return;
    }

    const pending = connections.filter(conn => {
      const status = getSyncStatus(conn);
      const terminal = isTerminalStatus(status);
      if (!terminal && !pollingStartTimeRef.current.has(conn.id)) {
        pollingStartTimeRef.current.set(conn.id, Date.now());
      }
      return !terminal;
    });

    if (pending.length === 0) {
      stopPolling();
      return;
    }

    if (pollingTimerRef.current) return;

    pollingTimerRef.current = setInterval(() => {
      const list = connections || [];
      const pendingIds = list
        .filter(conn => {
          const status = getSyncStatus(conn);
          const terminal = isTerminalStatus(status);
          const stop = shouldStopPolling(conn.id);
          if (stop) {
            cleanupPollingRecord(conn.id);
            return false;
          }
          return !terminal;
        })
        .map(conn => conn.id);

      if (pendingIds.length === 0) {
        stopPolling();
        return;
      }

      Promise.all(pendingIds.map(id => refreshConnection && refreshConnection(id)))
        .catch(() => {});
    }, 5000);

    return () => {
      stopPolling();
    };
  }, [connections, getSyncStatus, isTerminalStatus, refreshConnection, shouldStopPolling, cleanupPollingRecord, stopPolling]);

  if (!isDataLoaded) return null;

  if (isLoading && connections.length === 0) return (<CenteredLoading />);

  return (
    <>
      <CustomizeTable
        className="sea-qa-project-connections-table"
        columns={columns}
        rows={connections}
        emptyTip={
          (
            <>
              <EmptyTip
                title={gettext('No connections')}
                text={gettext('Connections enable you to sync contents from third party applications and search them')}
              >
                <Button color="primary" className="mt-6 d-flex align-items-center" onClick={() => handleModify()}>
                  <Icon symbol="add" className="mr-1" />
                  {gettext('Add connection')}
                </Button>
              </EmptyTip>
            </>
          )
        }
        isLoading={isLoading}
        loadMore={loadMore}
        onDelete={handleDelete}
        onModify={handleModify}
        onMore={onMore}
        expandRow={handleExpandRow}
        onManualSync={onManualSync}
        onUpdate={modifyConnectionStatus}
        handleStatusActive={handleStatusActive}
      />
      {isShowStatusDialog && (
        <ConnectionStatusDialog
          projectUuid={projectUuid}
          connectionId={activeRecordRef.current?.id}
          onToggle={closeStatusDialog}
        />
      )}
    </>
  );
};

export default AllConnections;
