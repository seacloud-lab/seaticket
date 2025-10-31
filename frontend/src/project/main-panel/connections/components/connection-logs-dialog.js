import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader, toaster } from '@/components';
import { connectionsAPI } from '../../../api';
import { Utils } from '@/utils/utils';
import EmptyTip from '@/components/empty-tip';

const ConnectionLogsDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [logs, setLogs] = useState(null);

  const getConnectionLogs = useCallback(() => {
    connectionsAPI.getConnectionLogs(projectUuid, connectionId).then(res => {
      setLogs(res.data.last_sync_log);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [connectionId]);

  useEffect(() => {
    getConnectionLogs();
  }, []);

  return (
    <Modal isOpen={true} toggle={onToggle} style={{ minWidth: 900 }}>
      <ModalHeader toggle={onToggle}>{gettext('Connection logs')}</ModalHeader>
      <ModalBody>
        {logs ?
          <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '16px' }}>
            <div className="site-page-content" dangerouslySetInnerHTML={{ __html: logs }}></div>
          </div>
          :
          <EmptyTip
            title={gettext('No logs')}
          />
        }
      </ModalBody>
    </Modal>
  );
};

ConnectionLogsDialog.propTypes = {
  projectUuid: PropTypes.string,
  connectionId: PropTypes.string,
  onToggle: PropTypes.func.isRequired
};

export default ConnectionLogsDialog;
