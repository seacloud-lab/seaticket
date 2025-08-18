import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '../../../constants';
import { ModalHeader } from '../../../components';

const ConnectionStatusDialog = ({ record, onToggle }) => {
  const status = record.status;
  return (
    <Modal isOpen={true} toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{gettext('Connection status')}</ModalHeader>
      <ModalBody>
        <p>{gettext('Last indexed count')}: {status.last_indexed_count}</p>
        <p>{gettext('Last index status')}: {status.last_index_status}</p>
        <p>{gettext('Total records')}: {status.total_records}</p>
        <p>{gettext('Last sync count')}: {status.last_sync_count}</p>
        <p>{gettext('Last sync status')}: {status.last_sync_status}</p>
      </ModalBody>
    </Modal>
  );
};

ConnectionStatusDialog.propTypes = {
  record: PropTypes.object,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionStatusDialog;
