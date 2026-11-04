import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, ModalBody } from 'reactstrap';
import { CenteredLoading, EmptyTip, Icon, ModalHeader } from '@/components';
import { gettext, mediaUrl } from '@/constants';
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
      <div className="seaqa-connection-statistics-dialog-error" role="alert">
        <div className="text-danger">{errorMessage}</div>
        <Button color="secondary" onClick={() => setRetryCount(count => count + 1)}>
          <Icon symbol="refresh" className="mr-2" />
          {gettext('Retry')}
        </Button>
      </div>
    );
  } else if (result.total === 0) {
    content = (
      <EmptyTip
        className="seaqa-connection-statistics-dialog-empty"
        src={`${mediaUrl}img/no-items-tip.png`}
        text={gettext('No issues in the past 12 months.')}
      />
    );
  } else {
    content = (
      <div className="seaqa-connection-statistics-dialog-grid">
        <section className="seaqa-connection-statistics-dialog-panel">
          <h3 className="seaqa-connection-statistics-dialog-panel-title">{gettext('{name} issue types').replace('{name}', connection.name)}</h3>
          <StatisticsPieChart series={result.series} />
        </section>
        <section className="seaqa-connection-statistics-dialog-panel">
          <h3 className="seaqa-connection-statistics-dialog-panel-title">{gettext('{name} monthly issue count').replace('{name}', connection.name)}</h3>
          <StatisticsChart months={result.months} series={monthlyTotals} isTotal={true} />
        </section>
        <section className="seaqa-connection-statistics-dialog-panel seaqa-connection-statistics-dialog-panel-wide">
          <h3 className="seaqa-connection-statistics-dialog-panel-title">{gettext('{name} issues by type').replace('{name}', connection.name)}</h3>
          <StatisticsChart months={result.months} series={result.series} />
        </section>
      </div>
    );
  }

  return (
    <Modal isOpen={true} toggle={onToggle} className="seaqa-connection-statistics-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Statistics')}</ModalHeader>
      <ModalBody>
        <div className="seaqa-connection-statistics-dialog-content">{content}</div>
      </ModalBody>
    </Modal>
  );
};

export default ConnectionStatisticsDialog;
