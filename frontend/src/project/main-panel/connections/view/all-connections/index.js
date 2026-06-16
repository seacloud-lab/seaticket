import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { connectionsAPI } from '../../../../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '@/components';
import ConnectionStatusDialog from '../../components/connection-status-dialog';
import ConnectionLogsDialog from '../../components/connection-logs-dialog';
import ConfigureWebhookDialog from '../../components/configure-webhook-dialog';
import createFormatter from '../../components/cell-formatter';
import { CONNECTION_FIELD_TYPE, CONNECTION_SYNC_STATUS } from '../../constants';
import { useConnections, useConnectionsPage } from '../../hooks';
import SelfQuery from '@/utils/self-query';
import { BAR_TYPE } from '@/project/constants';
import { isConnectionSyncCompleted, isConnectionFirstSync } from '../../utils';
import { areArraysEqual } from '@/utils/array-utils';

import './index.css';

const { isProjectAdmin } = window.app.pageOptions;

const AllConnections = ({ projectUuid, modifyLocalBar }) => {
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);
  const [isShowLogDialog, setIsShowLogDialog] = useState(false);
  const [isShowWebhookDialog, setIsShowWebhookDialog] = useState(false);

  const { isLoading, isLoadingMore, connections, reloadConnections, loadMore, handleModify, handleDelete,
    modifyConnectionIsActiveStatus, modifyLocalConnectionRecord, modifyLocalConnectionsSyncStatus,
  } = useConnections();
  const { togglePageSlugId } = useConnectionsPage();

  const activeRecordRef = useRef(null);
  const lastQueryRecordIds = useRef([]);

  const selfQuery = useMemo(() => new SelfQuery({
    api: (ids) => connectionsAPI.queryConnectionsStatus(projectUuid, ids).then(res => res.data || {}),
    callback: modifyLocalConnectionsSyncStatus,
    endCondition: isConnectionSyncCompleted,
    maxRetries: 50,
  }), [projectUuid, modifyLocalConnectionsSyncStatus]);

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

  const onConfigureWebhook = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowWebhookDialog(true);
  }, []);

  const closeWebhookDialog = useCallback(() => {
    activeRecordRef.current = null;
    setIsShowWebhookDialog(false);
  }, []);

  const handleWebhookSubmit = useCallback(({ name, config }, callback) => {
    const record = activeRecordRef.current;
    if (!record) return;
    connectionsAPI.modifyConnection(projectUuid, record.id, { name, config }).then(() => {
      toaster.success(gettext('Webhook configured successfully'));
      modifyLocalConnectionRecord(record.id, { config });
      closeWebhookDialog();
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      callback && callback();
    });
  }, [projectUuid, modifyLocalConnectionRecord, closeWebhookDialog]);

  const handleExpandRow = useCallback((row) => {
    togglePageSlugId && togglePageSlugId(row.id);
    modifyLocalBar && modifyLocalBar([BAR_TYPE.CONNECTION, row?.id]);
  }, [togglePageSlugId, modifyLocalBar]);

  const onManualSync = useCallback((record) => {
    const id = record?.id || activeRecordRef.current?.id;
    if (!id) return;
    connectionsAPI.triggerSync(projectUuid, id).then(() => {
      toaster.success(gettext('Sync task queued'));
      modifyLocalConnectionsSyncStatus({
        [id]: {
          status: { last_sync_status: CONNECTION_SYNC_STATUS.PENDING },
          last_sync_time: null,
        }
      });
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
  }, [projectUuid, modifyLocalConnectionsSyncStatus]);

  const handleStatusActive = (activeStatus, row) => {
    const { is_active: oldStatus, id } = row;
    if (activeStatus === oldStatus) return;
    modifyConnectionIsActiveStatus(id, activeStatus);
  };

  useEffect(() => {
    reloadConnections();
  }, []);

  const rowsDidMount = useCallback((rows) => {
    const synchronizingRows = rows.filter(r => isConnectionFirstSync(r) && !isConnectionSyncCompleted(r)).map(r => r.id);
    if (areArraysEqual(lastQueryRecordIds.current, synchronizingRows)) return;
    lastQueryRecordIds.current = synchronizingRows;
    selfQuery.start(synchronizingRows);
  }, [selfQuery]);

  const rowsWillUnmount = useCallback(() => {
    selfQuery.clear();
  }, []);

  useEffect(() => {
    reloadConnections();
    return () => {
      selfQuery.clear();
    };
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <>
      <CustomizeTable
        className="seaqa-project-connections-table"
        columns={columns}
        rows={connections}
        emptyTip={
          <EmptyTip
            title={gettext('No connections')}
            text={gettext('Connections enable you to sync contents from third party applications and search them')}
          >
            <Button color="primary" className="mt-6 d-flex align-items-center" onClick={() => handleModify()}>
              <Icon symbol="plus" className="mr-1" />
              {gettext('New connection')}
            </Button>
          </EmptyTip>
        }
        isLoading={isLoadingMore}
        loadMore={loadMore}
        onDelete={isProjectAdmin ? handleDelete : null}
        onModify={isProjectAdmin ? handleModify : null}
        onMore={onMore}
        expandRow={handleExpandRow}
        onManualSync={onManualSync}
        onViewLog={onViewLog}
        onConfigureWebhook={onConfigureWebhook}
        onUpdate={modifyConnectionIsActiveStatus}
        handleStatusActive={isProjectAdmin ? handleStatusActive : null}
        rowsDidMount={rowsDidMount}
        rowsWillUnmount={rowsWillUnmount}
        modifyLocalRow={modifyLocalConnectionRecord}
      />
      {isShowStatusDialog && (
        <ConnectionStatusDialog
          projectUuid={projectUuid}
          connectionId={activeRecordRef.current?.id}
          onToggle={closeStatusDialog}
          onManualSync={onManualSync}
          record={activeRecordRef.current}
        />
      )}
      {isShowLogDialog && (
        <ConnectionLogsDialog
          projectUuid={projectUuid}
          connectionId={activeRecordRef.current?.id}
          onToggle={closeLogDialog}
        />
      )}
      {isShowWebhookDialog && activeRecordRef.current && (
        <ConfigureWebhookDialog
          record={activeRecordRef.current}
          onSubmit={handleWebhookSubmit}
          onToggle={closeWebhookDialog}
        />
      )}
    </>
  );
};

export default AllConnections;
