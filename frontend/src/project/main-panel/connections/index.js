import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { connectionsAPI } from '../../api';
import Connection from '../../models/connection';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { CommonOperationConfirmationDialog, Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '../../../components';
import TopBar from '../top-bar';
import NewConnectionDialog from './new-connection-dialog';
import ModifyConnectionDialog from './modify-connection-dialog';
import ConnectionStatusDialog from './connection-status-dialog';
import createFormatter from './cell-formatter';
import { CONNECTION_FIELD_TYPE } from '../../constants';
import dayjs from '../../../utils/dayjs';

import './index.css';


const { projectUuid } = window.app.pageOptions;

const Connections = ({ title }) => {
  const [isLoading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [isShowRecordDialog, setIsShowRecordDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  const activeRecordRef = useRef(null);

  const columns = useMemo(() => {
    return [
      { key: 'name', name: gettext('Connection'), type: CONNECTION_FIELD_TYPE.CONNECTION_NAME, width: '40%' },
      { key: 'indexed_at', name: gettext('Last indexed at'), type: CONNECTION_FIELD_TYPE.DATE, width: '20%' },
      { key: '', name: '', type: CONNECTION_FIELD_TYPE.EMPTY, width: '30%' },
      { key: 'op', name: '', type: CONNECTION_FIELD_TYPE.OP, width: '10%' }
    ].map(column => (
      {
        ...column,
        formatter: createFormatter(column.type)
      }
    ));
  }, []);
  const btns = useMemo(() => {
    return [
      { name: (
        <>
          <Icon symbol="add" className="mr-1" />
          {gettext('Add connection')}
        </>
      ),
      func: () => {
        activeRecordRef.current = null;
        setIsShowRecordDialog(true);
      } }
    ];
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
      callback && callback(record);
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

  const openStatusDialog = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowStatusDialog(true);
  }, []);

  const closeStatusDialog = useCallback(() => {
    setIsShowStatusDialog(false);
  }, []);

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
  }, []);

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

  if (isLoading && records.length === 0) return (<CenteredLoading />);

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
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
        showStatus={openStatusDialog}
        onManualSync={onManualSync}
      >
        {records.length !== 0 && (<CustomizeTable.Header btns={btns} />)}
      </CustomizeTable>
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

export default Connections;
