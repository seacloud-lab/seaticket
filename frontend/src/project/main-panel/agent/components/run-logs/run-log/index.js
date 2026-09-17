import React, { useLayoutEffect, useRef } from 'react';
import classnames from 'classnames';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import { FROM_NOW } from '@/sea-metadata/constants';
import { LOG_STATUS } from '../../../constants';
import { getAgentResource } from '../../../utils';
import ResourceTitle from '../../resource-title';

import './index.css';

const RunLog = ({ active, runLog, onClick, onRemove }) => {
  const { key, num_of_runs, last_active_at, status } = runLog;
  const runLogRef = useRef(null);

  useLayoutEffect(() => {
    if (!runLog.isFiltered || !runLogRef.current) return;

    const runLogElement = runLogRef.current;
    runLogElement.style.height = `${runLogElement.getBoundingClientRect().height}px`;
    runLogElement.getBoundingClientRect();
    const animationFrame = requestAnimationFrame(() => {
      runLogElement.style.height = '0';
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [runLog.isFiltered]);

  let runsTip = num_of_runs + ' ' + gettext('Runs');
  if (num_of_runs === 0) runsTip = '';
  if (num_of_runs === 1) runsTip = num_of_runs + ' ' + gettext('Run');
  if (num_of_runs >= 100) runsTip = '99+';

  const resource = getAgentResource(runLog);

  return (
    <div
      data-key={key}
      ref={runLogRef}
      className={classnames('seaqa-agent-run-log w-100 d-flex flex-column position-relative', {
        'active': active,
        'seaqa-agent-run-log-filtered': runLog.isFiltered
      })}
      onClick={onClick}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'height') onRemove();
      }}
    >
      <div className="seaqa-agent-run-log-header d-flex align-items-center">
        <div className="seaqa-agent-run-log-resource-icon d-flex justify-content-center align-items-center">
          <img src={resource.icon} alt="" />
        </div>
        <div className="seaqa-agent-run-log-resource-info flex-1 text-truncate">
          {resource.type_name + ' #' + resource._id}
        </div>
        {status && (
          <>
            {status === LOG_STATUS.PROCESSED && (<IconButton size={12} className="no-hover-bg seaqa-agent-run-status run-done" icon="check-circle" />)}
            {status === 'no_action_needed' && (<IconButton size={12} className="no-hover-bg seaqa-agent-run-status run-no-action-needed" icon="info-filled" />)}
          </>
        )}
      </div>
      <ResourceTitle resource={resource} className="seaqa-agent-run-log-body" displayDetails={false} />
      <div className="seaqa-agent-run-log-footer d-flex align-items-center">
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
