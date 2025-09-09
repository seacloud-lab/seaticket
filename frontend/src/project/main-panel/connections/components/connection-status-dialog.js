import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster } from '@/components';
import { connectionsAPI } from '../../../api';
import { Utils } from '@/utils/utils';
import dayjs from '@/utils/dayjs';

const ConnectionStatusDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [record, setRecord] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const getConnectionRecord = useCallback(() => {
    connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      setRecord(res.data.record);
      setLoading(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [record, isLoading]);

  useEffect(() => {
    getConnectionRecord();
  }, []);

  const status = record && record.status ? JSON.parse(record.status) : {};
  const last_sync_time = record && record.last_sync_time ? dayjs(record.last_sync_time).format('YYYY-MM-DD HH:mm:ss') : '--';
  const last_index_time = record && record.indexed_at ? dayjs(record.indexed_at).format('YYYY-MM-DD HH:mm:ss') : '--';
  return (
    <Modal isOpen={true} toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        {isLoading ?
          <CenteredLoading />
          :
          <>
            <p>{gettext('Total records')}: {status.total_records}</p>
            <p>{gettext('Last sync count')}: {status.last_sync_count}</p>
            <p>{gettext('Last sync status')}: {status.last_sync_status}</p>
            <p>{gettext('Last sync time')}: {last_sync_time}</p>
            <p>{gettext('Last indexed count')}: {status.last_indexed_count}</p>
            <p>{gettext('Last index status')}: {status.last_index_status}</p>
            <p>{gettext('Last index time')}: {last_index_time}</p>
          </>
        }
      </ModalBody>
    </Modal>
  );
};

ConnectionStatusDialog.propTypes = {
  projectUuid: PropTypes.string,
  record: PropTypes.object,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionStatusDialog;
