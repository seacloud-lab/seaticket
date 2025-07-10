import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Table from '../table';
import CenteredLoading from '../../../components/centered-loading';
import toaster from '../../../components/toaster';
import { seaQAAPI } from '../../../api/web-api';
import { Connection } from '../../models';
import { gettext } from '../../../constants';
import ConnectionRecordDialog from '../../components/connection-record-dialog';
import { Utils } from '../../../utils/utils';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import { CONNECTION_FIELDS, TABLE_COLUMN_TYPE } from '../../constants';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Records = ({ type, title }) => {

  const [isLoading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [isShowRecordDialog, setIsShowRecordDialog] = useState(false);
  const [isShowConfirmDialog, setIsShowConfirmDialog] = useState(false);

  const fields = useMemo(() => CONNECTION_FIELDS[type] || [], [type]);
  const columns = useMemo(() => {
    let displayColumns = fields.filter(key => key.is_display);
    displayColumns = displayColumns.map(c => {
      const width = 0.25 / displayColumns.length;
      return {
        ...c,
        width: `${width * 100}%`,
        is_custom: true,
      };
    });

    return [
      { key: 'name', name: gettext('Name'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%' },
      ...displayColumns, // 20%
      { key: 'updated_at', name: gettext('Last crawled'), type: TABLE_COLUMN_TYPE.DATE, width: '15%' },
      { key: 'status', name: gettext('Status'), type: TABLE_COLUMN_TYPE.TEXT, width: '15%' },
      { key: 'index_time', name: gettext('Index time'), type: TABLE_COLUMN_TYPE.DATE, width: '15%' },
      { key: 'op', name: '', type: TABLE_COLUMN_TYPE.OP, width: '10%' },
    ];
  }, [fields]);
  const btns = useMemo(() => {
    return [
      { name: gettext('Add'), func: () => {
        activeRecordRef.current = null;
        setIsShowRecordDialog(true);
      } }
    ];
  }, []);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  const activeRecordRef = useRef(null);

  const closeConnectionDialog = useCallback(() => {
    setIsShowRecordDialog(false);
  }, []);

  const createConnection = useCallback(({ name, config }, resetSubmittingState) => {
    seaQAAPI.createConnection(workspaceID, projectUuid, type, { name, config }).then(res => {
      const record = res.data.record;
      const newRecords = [...records, new Connection(record)];
      setRecords(newRecords);
      setIsShowRecordDialog(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [type, records]);

  const deleteConnectionRecord = useCallback(() => {
    console.log(activeRecordRef.current);
    seaQAAPI.deleteConnection(workspaceID, projectUuid, activeRecordRef.current.id).then(res => {
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

  const modifyConnection = useCallback(({ name, config }, resetSubmittingState) => {
    seaQAAPI.modifyConnection(workspaceID, projectUuid, type, activeRecordRef.current.id, { name, config }).then(res => {
      const activeRecordIndex = records.findIndex(c => c.id === activeRecordRef.current.id);
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
  }, [type, records]);

  const openModifyDialog = useCallback((record) => {
    activeRecordRef.current = record;
    setIsShowRecordDialog(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    seaQAAPI.listConnections(workspaceID, projectUuid, type, pageRef.current, pageCountRef.current).then(res => {
      const records = res.data.records.map(r => new Connection(r));
      let newRecords = pageRef.current === 1 ? [] : records.slice(0);
      let recordsMap = newRecords.reduce((pre, cur) => {
        if (pre[cur.id]) return pre;
        pre[cur.id] = true;
        return pre;
      }, {});

      if (records.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      records.forEach(record => {
        if (!recordsMap[record.id]) {
          newRecords.push(record);
        }
      });
      setRecords(newRecords);
      setLoading(false);
    }).catch(error => {
      console.log(error);
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [records, type, isLoading]);

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadMore();
  }, [type]);

  if (isLoading && records.length === 0) return (<CenteredLoading />);

  return (
    <>
      <Table
        columns={columns}
        rows={records}
        emptyTip={gettext('There are no connections yet')}
        isLoading={isLoading}
        loadMore={loadMore}
        onDelete={openDeleteConfirmDialog}
        onModify={openModifyDialog}
      >
        <Table.Header title={title} btns={btns} />
      </Table>
      {isShowRecordDialog && (
        <ConnectionRecordDialog
          record={activeRecordRef.current}
          fields={fields}
          onToggle={closeConnectionDialog}
          onSubmit={activeRecordRef.current ? modifyConnection : createConnection} />
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
    </>
  );
};

export default Records;
