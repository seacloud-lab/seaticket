import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { connectionsAPI } from '../../../../api';
import { Connection } from '../../models';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { CommonOperationConfirmationDialog, Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '@/components';
import NewConnectionDialog from '../../components/new-connection-dialog';
import ModifyConnectionDialog from '../../components/modify-connection-dialog';
import ConnectionStatusDialog from '../../components/connection-status-dialog';
import createFormatter from '../../components/cell-formatter';
import { CONNECTION_FIELD_TYPE } from '../../../../constants';
import { useConnectionsPage } from '../../hooks';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

import './index.css';

const AllConnections = ({ projectUuid }) => {
  const [isLoading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [isShowRecordDialog, setIsShowRecordDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  const { togglePageType, updatePageName } = useConnectionsPage();

  const activeRecordRef = useRef(null);

  const columns = useMemo(() => {
    return [
      { key: 'name', name: gettext('Connection'), type: CONNECTION_FIELD_TYPE.CONNECTION_NAME, width: '40%' },
      { key: 'indexed_at', name: gettext('Last indexed at'), type: CONNECTION_FIELD_TYPE.DATE, width: '20%' },
      { key: 'is_active', name: gettext('Status'), type: CONNECTION_FIELD_TYPE.ACTIVE_STATUS, width: '10%', editable: true },
      { key: '', name: '', type: CONNECTION_FIELD_TYPE.EMPTY, width: '20%' },
      { key: 'op', name: '', type: CONNECTION_FIELD_TYPE.OP, width: '10%' }
    ].map(column => (
      {
        ...column,
        formatter: createFormatter(column)
      }
    ));
  }, []);

  const onUpdate = useCallback((connectionId, update) => {
    connectionsAPI.updateConnectionStatus(projectUuid, connectionId, update).then(() => {
      setRecords(prev => prev.map(record =>
        record.id === connectionId ? { ...record, ...update } : record
      ));
      if (Object.keys(update).includes('is_active')) {
        toaster.success(update.is_active ? gettext('Activated') : gettext('Deactivated'));
      }
    }).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
    });
  }, []);

  const closeConnectionDialog = useCallback(() => {
    setIsShowRecordDialog(false);
  }, []);

  const createConnection = useCallback(({ type, name, config }, resetSubmittingState, isShowRecordDialog = false, callback) => {
    connectionsAPI.createConnection(projectUuid, { type, name, config }).then(res => {
      const record = new Connection(res.data.record);
      const newRecords = [...records, record];
      setRecords(newRecords);
      setIsShowRecordDialog(isShowRecordDialog);
      callback && callback(record, res.data.service_url);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [records]);

  const deleteConnectionRecord = useCallback(() => {
    connectionsAPI.deleteConnection(projectUuid, activeRecordRef.current.id).then(res => {
      const activeSiteIndex = records.findIndex(record => record.id === activeRecordRef.current.id);
      let newSites = records.slice(0);
      if (activeSiteIndex > -1) {
        newSites.splice(activeSiteIndex, 1);
      }
      activeRecordRef.current = null;
      setRecords(newSites);
      setIsShowConfirmDialog(false);
      activeRecordRef.current = null;
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsShowConfirmDialog(false);
      activeRecordRef.current = null;
    });
  }, [records]);

  const closeDeleteConfirmDialog = useCallback(() => {
    setIsShowConfirmDialog(false);
  }, []);

  const openDeleteConfirmDialog = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowConfirmDialog(true);
  }, []);

  const modifyConnection = useCallback(({ name, config }, resetSubmittingState, recordId) => {
    const activeRecordId = recordId || activeRecordRef.current.id;
    connectionsAPI.modifyConnection(projectUuid, activeRecordId, { name, config }).then(res => {
      const activeRecordIndex = records.findIndex(c => c.id === activeRecordId);
      const newRecord = new Connection(res.data.record);
      let newRecords = records.slice(0);
      if (activeRecordIndex === -1) {
        newRecords.push(newRecord);
      } else {
        newRecords[activeRecordIndex] = newRecord;
      }
      setRecords(newRecords);
      activeRecordRef.current = null;
      setIsShowRecordDialog(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [records]);

  const openModifyDialog = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowRecordDialog(true);
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

  const onManualSync = useCallback((record) => {
    const id = record?.id || activeRecordRef.current?.id;
    if (!id) return;
    connectionsAPI.triggerSync(projectUuid, id).then(() => {
      toaster.success(gettext('Sync task queued'));
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
  }, [projectUuid]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    connectionsAPI.listConnections(projectUuid, pageRef.current, pageCountRef.current).then(res => {
      const moreRecords = res.data.records.map(r => new Connection(r));
      let newRecords = pageRef.current === 1 ? [] : records.slice(0);
      let recordsMap = newRecords.reduce((pre, cur) => {
        if (pre[cur.id]) return pre;
        pre[cur.id] = true;
        return pre;
      }, {});

      if (moreRecords.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      moreRecords.forEach(record => {
        if (!recordsMap[record.id]) {
          newRecords.push(record);
        }
      });
      setRecords(newRecords);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [records, isLoading]);

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setRecords([]);
    loadMore();
  }, []);

  useEffect(() => {
    const unsubscribeNewConnection = eventBus.subscribe(EVENT_BUS_TYPE.NEW_CONNECTION, () => {
      activeRecordRef.current = null;
      setIsShowRecordDialog(true);
    });
    return () => {
      unsubscribeNewConnection();
    };
  }, []);

  if (isLoading && records.length === 0) return (<CenteredLoading />);

  return (
    <>
      <CustomizeTable
        className="sea-qa-project-connections-table p-4"
        columns={columns}
        rows={records}
        emptyTip={
          (
            <>
              <EmptyTip
                title={gettext('No connections')}
                text={gettext('Connections enable you to sync contents from third party applications and search them')}
              >
                <Button color="primary" className="mt-6 d-flex align-items-center" onClick={() => openModifyDialog()}>
                  <Icon symbol="add" className="mr-1" />
                  {gettext('Add connection')}
                </Button>
              </EmptyTip>
            </>
          )
        }
        isLoading={isLoading}
        loadMore={loadMore}
        onDelete={openDeleteConfirmDialog}
        onModify={openModifyDialog}
        onMore={onMore}
        expandRow={handleExpandRow}
        onManualSync={onManualSync}
        onUpdate={onUpdate}
      />
      {isShowRecordDialog && (
        <>
          {activeRecordRef.current ?
            <ModifyConnectionDialog
              record={activeRecordRef.current}
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
          message={gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', activeRecordRef.current.name)}
          executeOperation={deleteConnectionRecord}
          confirmBtnText={gettext('Delete')}
          toggleDialog={closeDeleteConfirmDialog}
        />
      )}
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
