import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody } from 'reactstrap';
import { CenteredLoading, Icon, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import StatisticsChart from './chart';
import StatisticsPieChart from './pie-chart';

import './index.css';

const ConnectionStatisticsDialog = ({ projectUuid, connection, onToggle }) => {
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const monthlyTotals = useMemo(() => [{
    issue_type: gettext('Issue total'),
    counts: (result?.months || []).map((month, index) =>
      result.series.reduce((total, item) => total + (item.counts[index] || 0), 0)
    ),
  }], [result]);

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
        {result.total === 0 && <div className="connection-statistics-empty">{gettext('No issues in the past 12 months.')}</div>}
        <div className="connection-statistics-grid">
          <section className="connection-statistics-panel">
            <h3>{gettext('{name} issue types').replace('{name}', connection.name)}</h3>
            <StatisticsPieChart series={result.series} />
          </section>
          <section className="connection-statistics-panel">
            <h3>{gettext('{name} monthly issue count').replace('{name}', connection.name)}</h3>
            <StatisticsChart months={result.months} series={monthlyTotals} isTotal={true} />
          </section>
          <section className="connection-statistics-panel connection-statistics-panel-wide">
            <h3>{gettext('{name} issues by type').replace('{name}', connection.name)}</h3>
            <StatisticsChart months={result.months} series={result.series} />
          </section>
        </div>
      </>
    );
  }

  return (
    <Modal isOpen={true} toggle={onToggle} className="connection-statistics-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Statistics')}</ModalHeader>
      <ModalBody>
        <div className="connection-statistics-content">{content}</div>
      </ModalBody>
    </Modal>
  );
};

export default ConnectionStatisticsDialog;
