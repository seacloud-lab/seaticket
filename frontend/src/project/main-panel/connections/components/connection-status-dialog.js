import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster } from '@/components';
import { connectionsAPI } from '../../../api';
import { Utils } from '@/utils/utils';
import { Connection } from '../models';

const ConnectionStatusDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [record, setRecord] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const getConnectionRecord = useCallback(() => {
    connectionsAPI.getConnection(projectUuid, connectionId).then(res => {
      setRecord(new Connection(res.data.record));
      setLoading(false);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [record, isLoading]);

  useEffect(() => {
    getConnectionRecord();
  }, []);

  return (
    <Modal isOpen={true} toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        {isLoading ?
          <CenteredLoading />
          :
          <>
            <p>{gettext('Total records')}: {record.status.total_records}</p>
            <p>{gettext('Last sync count')}: {record.status.last_sync_count}</p>
            <p>{gettext('Last sync status')}: {record.status.last_sync_status}</p>
            <p>{gettext('Last sync time')}: {record.last_sync_time}</p>
            <p>{gettext('Last indexed count')}: {record.status.last_indexed_count}</p>
            <p>{gettext('Last index status')}: {record.status.last_index_status}</p>
            <p>{gettext('Last index time')}: {record.indexed_at}</p>
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
