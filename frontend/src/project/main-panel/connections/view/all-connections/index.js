import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { connectionsAPI } from '../../../../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { Icon, toaster, CenteredLoading, EmptyTip, CustomizeTable } from '@/components';
import ConnectionStatusDialog from '../../components/connection-status-dialog';
import createFormatter from '../../components/cell-formatter';
import { CONNECTION_FIELD_TYPE } from '../../../../constants';
import { useConnections, useConnectionsPage } from '../../hooks';

import './index.css';

const AllConnections = ({ projectUuid }) => {
  const [isShowStatusDialog, setIsShowStatusDialog] = useState(false);

  const activeRecordRef = useRef(null);

  const { isLoading, isDataLoaded, connections, reload, loadMore, handleModify, handleDelete, modifyConnectionStatus } = useConnections();
  const { togglePageType, updatePageName } = useConnectionsPage();

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


  useEffect(() => {
    reload();
  }, []);

  if (!isDataLoaded) return null;

  if (isLoading && connections.length === 0) return (<CenteredLoading />);

  return (
    <>
      <CustomizeTable
        className="sea-qa-project-connections-table p-4"
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
