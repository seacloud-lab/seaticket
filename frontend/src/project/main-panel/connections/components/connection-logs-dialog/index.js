import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredError, CenteredLoading, ModalHeader, EmptyTip } from '@/components';
import { connectionsAPI } from '../../../../api';
import { Utils } from '@/utils/utils';

import './index.css';

const ConnectionLogsDialog = ({ projectUuid, connectionId, onToggle }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [logs, setLogs] = useState('');

  useEffect(() => {
    connectionsAPI.getConnectionLogs(projectUuid, connectionId).then(res => {
      setLogs(res.data.last_sync_log);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const renderContent = useCallback(() => {
    if (isLoading) return (<CenteredLoading />);
    if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
    if (!logs) return (<EmptyTip title={gettext('No logs')} />);
    return (
      <div className="connection-logs-content p-4" dangerouslySetInnerHTML={{ __html: logs }}></div>
    );
  }, [isLoading, errorMessage, logs]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-logs-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Connection logs')}</ModalHeader>
      <ModalBody>
        {renderContent()}
      </ModalBody>
    </Modal>
  );
};

export default ConnectionLogsDialog;
