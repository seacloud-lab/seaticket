import React, { useEffect, useState } from 'react';
import { Button, Modal, ModalBody } from 'reactstrap';
import { CenteredLoading, Icon, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import StatisticsChart from './chart';

import './index.css';

const ConnectionStatisticsDialog = ({ projectUuid, connection, onToggle }) => {
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setResult(null);
    setErrorMessage('');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    connectionsAPI.getConnectionStatistics(projectUuid, connection.id, controller.signal, timezone).then(response => {
      if (!controller.signal.aborted) setResult(response.data);
    }).catch(error => {
      if (!controller.signal.aborted) setErrorMessage(Utils.getErrorMsg(error));
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [projectUuid, connection.id, retryCount]);

  let content;
  if (isLoading) {
    content = <CenteredLoading />;
  } else if (errorMessage) {
    content = (
      <div className="connection-statistics-error" role="alert">
        <div className="text-danger">{errorMessage}</div>
        <Button color="secondary" onClick={() => setRetryCount(count => count + 1)}>
          <Icon symbol="refresh" className="mr-2" />
          {gettext('Retry')}
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <div className="connection-statistics-summary">
          <span>{result.months[0]} - {result.months[result.months.length - 1]}</span>
          <span>{gettext('Total issues: {count}').replace('{count}', result.total.toLocaleString())}</span>
        </div>
        <h6 className="connection-statistics-heading">{gettext('Monthly issues by type')}</h6>
        {result.total === 0 && <div className="connection-statistics-empty">{gettext('No issues in the past 12 months.')}</div>}
        <StatisticsChart months={result.months} series={result.series} />
      </>
    );
  }

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-statistics-dialog">
      <ModalHeader toggle={onToggle}>
        <span className="connection-statistics-title" title={connection.name}>{connection.name}</span>
        <span className="connection-statistics-title-suffix"> / {gettext('Statistics')}</span>
      </ModalHeader>
      <ModalBody>
        <div className="connection-statistics-content">{content}</div>
      </ModalBody>
    </Modal>
  );
};

export default ConnectionStatisticsDialog;
