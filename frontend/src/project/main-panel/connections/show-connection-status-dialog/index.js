import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'reactstrap';
import { gettext } from '../../../../constants';
import { ModalHeader } from '../../../../components';


const ConnectionStatusDialog = ({ record, onToggle }) => {
  const status = record.status;

  return (
    <Modal isOpen={true} toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <p>last_indexed_count: {status.last_indexed_count}</p>
      <p>last_index_status: {status.last_index_status}</p>
      <p>total_records: {status.total_records}</p>
      <p>last_sync_count: {status.last_sync_count}</p>
      <p>last_sync_status: {status.last_sync_status}</p>
    </Modal>
  );
};

ConnectionStatusDialog.propTypes = {
  record: PropTypes.object,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionStatusDialog;
