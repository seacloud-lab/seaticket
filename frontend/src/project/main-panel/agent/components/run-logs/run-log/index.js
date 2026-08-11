import React from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import ResourceTitle from '../../resource-title';
import { FROM_NOW } from '@/sea-metadata/constants';
import { getAgentResource } from '../../../utils';

import './index.css';

const RunLog = ({
  active,
  runLog,
  onClick,
}) => {
  const { source_id, source_type, num_of_runs, last_active_at } = runLog;

  let runsTip = num_of_runs + ' ' + gettext('Runs');
  if (num_of_runs === 0) runsTip = '';
  if (num_of_runs === 1) runsTip = num_of_runs + ' ' + gettext('Run');
  if (num_of_runs >= 100) runsTip = '99+';

  const resource = getAgentResource(runLog);

  return (
    <div
      key={`${source_type}_${source_id}`}
      className={classnames('seaqa-agent-run-log w-100 d-flex flex-column position-relative', { 'active': active })}
      onClick={onClick}
    >
      <div className="seaqa-agent-run-log-header d-flex align-items-center">
        <div className="seaqa-agent-run-log-resource-icon d-flex justify-content-center align-items-center h-100 w-100 ">
          <img src={resource.icon} alt="" />
        </div>
        <div className="seaqa-agent-run-log-resource-info">
          {resource.type_name + ' #' + resource._id}
        </div>
      </div>
      <ResourceTitle resource={resource} className="seaqa-agent-run-log-body" displayDetails={false} />
      <div className="seaqa-agent-run-log-footer d-flex align-items-center">
        <span>
          {gettext('Last active:')}
        </span>
        <DateFormatter className="flex-1 text-truncate" value={last_active_at} column={{ data: { format: FROM_NOW } }} />
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
