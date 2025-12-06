import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { connectionsAPI } from '../../../../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '@/components';
import ConnectionStatusDialog from '../../components/connection-status-dialog';
import ConnectionLogsDialog from '../../components/connection-logs-dialog';
import createFormatter from '../../components/cell-formatter';
import { CONNECTION_FIELD_TYPE, CONNECTION_SYNC_COMPLETED_STATUS } from '../../constants';
import { useConnections, useConnectionsPage } from '../../hooks';
import { Connection } from '../../models';
import SelfQuery from '@/utils/self-query';
import { BAR_TYPE } from '@/project/constants';

import './index.css';

const AllConnections = ({ projectUuid, modifyLocalBar }) => {
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);
  const [isShowLogDialog, setIsShowLogDialog] = useState(false);

  const { isLoading, isConnectionsLoaded, connections, reloadConnections, loadMore, handleModify, handleDelete,
    modifyConnectionStatus, modifyLocalConnectionRecord, modifyLocalConnectionSyncStatus
  } = useConnections();
  const { togglePageSlugId, updateConnectionInfo } = useConnectionsPage();

  const activeRecordRef = useRef(null);
  const selfQuery = useMemo(() => new SelfQuery({
    api: (ids) => connectionsAPI.queryConnectionsStatus(projectUuid, ids).then(res => res.data || {}),
    callback: modifyLocalConnectionSyncStatus,
    endCondition: (v) => CONNECTION_SYNC_COMPLETED_STATUS.includes(v),
    maxRetries: 50,
    onEnd: async (endIds) => {
      for (const id of endIds) {
        try {
          const res = await connectionsAPI.getConnection(projectUuid, id);
          const fresh = new Connection(res.data.record);
          modifyLocalConnectionRecord(id, { last_sync_time: fresh.last_sync_time });
        } catch (e) {
          toaster.danger(e);
        }
      }
    }
  }), [projectUuid, modifyLocalConnectionSyncStatus, modifyLocalConnectionRecord]);

  const columns = useMemo(() => {
    return [
      { key: 'name', name: gettext('Connection'), type: CONNECTION_FIELD_TYPE.CONNECTION_NAME, width: 0.4 },
      { key: 'sync_status', name: gettext('Sync status'), type: CONNECTION_FIELD_TYPE.SYNC_STATUS, width: 0.2 },
      { key: 'last_sync_time', name: gettext('Last synced at'), type: CONNECTION_FIELD_TYPE.DATE, width: 0.2 },
      { key: '', name: '', type: CONNECTION_FIELD_TYPE.EMPTY, width: 0.2 },
      { key: 'op', name: '', type: CONNECTION_FIELD_TYPE.OP, width: 0.1 }
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

  const onViewLog = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowLogDialog(true);
  }, []);

  const closeLogDialog = useCallback(() => {
    activeRecordRef.current = null;
    setIsShowLogDialog(false);
  }, []);

  const handleExpandRow = useCallback((row) => {
    updateConnectionInfo && updateConnectionInfo({ name: row.name, type: row.type });
    togglePageSlugId && togglePageSlugId(row.id);
    modifyLocalBar && modifyLocalBar([BAR_TYPE.CONNECTION, String(row?.id)]);
  }, [togglePageSlugId, modifyLocalBar]);

  const onManualSync = useCallback((record) => {
    const id = record?.id || activeRecordRef.current?.id;
    if (!id) return;
    connectionsAPI.triggerSync(projectUuid, id).then(() => {
      toaster.success(gettext('Sync task queued'));
      modifyLocalConnectionRecord(id, { status: { ...record.status, last_sync_status: 'pending' } });
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
  }, [projectUuid, modifyLocalConnectionRecord]);

  const getConnectionStatus = useCallback((connectionId) => {
    return connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      const newRecord = new Connection(res.data.record);
      return newRecord.status;
    });
  });

  const handleStatusActive = (status, row) => {
    const { is_active: oldStatus, id } = row;
    if (status === oldStatus) return;
    modifyConnectionStatus(id, { 'is_active': status });
  };

  const rowsDidMount = useCallback((rows) => {
    const synchronizingRows = rows.filter(r => !CONNECTION_SYNC_COMPLETED_STATUS.includes(r?.status?.last_sync_status)).map(r => r.id);
    selfQuery.start(synchronizingRows);
  }, [selfQuery]);

  useEffect(() => {
    reloadConnections();
    return () => {
      selfQuery.clear();
    };
  }, []);

  if (!isConnectionsLoaded) return null;

  if (isLoading && connections.length === 0) return (<CenteredLoading />);

  return (
    <>
      <CustomizeTable
        className="sea-qa-project-connections-table"
        columns={columns}
        rows={connections}
        emptyTip={
          <EmptyTip
            title={gettext('No connections')}
            text={gettext('Connections enable you to sync contents from third party applications and search them')}
          >
            <Button color="primary" className="mt-6 d-flex align-items-center" onClick={() => handleModify()}>
              <Icon symbol="add" className="mr-1" />
              {gettext('New connection')}
            </Button>
          </EmptyTip>
        }
        isLoading={isLoading}
        loadMore={loadMore}
        onDelete={handleDelete}
        onModify={handleModify}
        onMore={onMore}
        expandRow={handleExpandRow}
        onManualSync={onManualSync}
        onViewLog={onViewLog}
        onUpdate={modifyConnectionStatus}
        handleStatusActive={handleStatusActive}
        rowsDidMount={rowsDidMount}
        getRowStatus={getConnectionStatus}
        modifyLocalRow={modifyLocalConnectionRecord}
      />
      {isShowStatusDialog && (
        <ConnectionStatusDialog
          projectUuid={projectUuid}
          connectionId={activeRecordRef.current?.id}
          onToggle={closeStatusDialog}
        />
      )}
      {isShowLogDialog && (
        <ConnectionLogsDialog
          projectUuid={projectUuid}
          connectionId={activeRecordRef.current?.id}
          onToggle={closeLogDialog}
        />
      )}
    </>
  );
};

export default AllConnections;
