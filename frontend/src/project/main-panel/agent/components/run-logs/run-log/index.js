import React from 'react';
import classnames from 'classnames';
import { getResourceIconURL, getResourceTypeName } from '@/project/utils';
import { gettext } from '@/constants';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import { CONNECTION_TYPES } from '@/project/main-panel/connections/constants';
import RunLogTitle from '../../run-log-title';

import './index.css';

const RunLog = ({
  active,
  runLog,
  onClick,
}) => {
  const { source_id, source_type, num_of_runs, last_active_at } = runLog;
  const sourceTypeName = getResourceTypeName(source_type);

  let runsTip = num_of_runs + ' ' + gettext('Runs');
  if (num_of_runs === 0) runsTip = '';
  if (num_of_runs === 1) runsTip = num_of_runs + ' ' + gettext('Run');
  if (num_of_runs >= 100) runsTip = '99+';

  let sourceId = source_id;
  if (CONNECTION_TYPES.find(connection => connection.type === source_type)) {
    const source_ids = source_id.split('_');
    sourceId = source_ids[1];
  }

  return (
    <div
      key={`${source_type}_${source_id}`}
      className={classnames('seaqa-agent-run-log w-100 d-flex flex-column position-relative', { 'active': active })}
      onClick={onClick}
    >
      <div className="seaqa-agent-run-log-header d-flex align-items-center mb-1">
        <div className="seaqa-agent-run-log-resource-icon d-center-middle">
          <img src={getResourceIconURL(source_type)} alt="" />
        </div>
        <div className="seaqa-agent-run-log-resource-info">
          {sourceTypeName + ' #' + sourceId}
        </div>
      </div>
      <RunLogTitle runLog={runLog} className="seaqa-agent-run-log-body" />
      <div className="seaqa-agent-run-log-footer d-flex align-items-center">
        <span>
          {gettext('Last active:')}
        </span>
        <DateFormatter className="flex-1 text-truncate" value={last_active_at} />
        {runsTip && (
          <div className="seaqa-agent-run-log-count px-2">
            {runsTip}
          </div>
        )}
      </div>
    </div>
  );
};

export default RunLog;
