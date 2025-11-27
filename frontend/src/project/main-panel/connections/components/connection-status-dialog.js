import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, ModalHeader, toaster } from '@/components';
import { connectionsAPI } from '../../../api';
import { Utils } from '@/utils/utils';
import { Connection } from '../models';
import DateFormatter from './cell-formatter/date-formatter';

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
            <p>{gettext('Last sync time')}: <DateFormatter value={record.last_sync_time} /></p>
            <p>{gettext('Last indexed count')}: {record.status.last_indexed_count}</p>
            <p>{gettext('Last index status')}: {record.status.last_index_status}</p>
            <p>{gettext('Last index time')}: <DateFormatter value={record.indexed_at} /></p>
            <p>{gettext('Last AI processing count')}: {record.ai_status.last_ai_processing_count}</p>
            <p>{gettext('Last AI processing status')}: {record.ai_status.last_ai_processing_status}</p>
            <p>{gettext('Last AI processing time')}: <DateFormatter value={record.last_ai_processing_time} /></p>
            <p>{gettext('Last AI indexed count')}: {record.ai_status.last_ai_indexed_count}</p>
            <p>{gettext('Last AI indexed status')}: {record.ai_status.last_ai_index_status}</p>
            <p>{gettext('Last AI indexed time')}: <DateFormatter value={record.ai_indexed_at} /></p>
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
