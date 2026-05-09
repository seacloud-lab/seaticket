import React from 'react';
import TypeSettings from './type-settings';
import LabelsSettings from './labels-settings';
import StateSettings from './state-settings';
import StateReasonSettings from './state-reason-settings';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

const GitHubIssuesDetails = ({
  record,
  columns,
  isReadonly,
  linkedTicketTitle,
  projectUuid,
  linkedTicketTools,
  onChange,
}) => {
  const labelsColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LABELS);
  const typeColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ISSUE_TYPE);
  const stateColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATE);
  const stateReasonColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON);
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);

  return (
    <>
      <LabelsSettings
        id="github-issue-labels-editor-popover"
        isReadonly={isReadonly}
        value={getCellValueByColumn(record, labelsColumn)}
        column={labelsColumn}
        onChange={onChange}
      />
      <StateSettings
        id="github-issue-state-editor-popover"
        isReadonly={isReadonly}
        state={getCellValueByColumn(record, stateColumn)}
        stateReason={getCellValueByColumn(record, stateReasonColumn)}
        stateColumn={stateColumn}
        stateReasonColumn={stateReasonColumn}
        onChange={onChange}
      />
      <StateReasonSettings
        id="github-issue-state-reason-editor-popover"
        isReadonly={isReadonly}
        value={getCellValueByColumn(record, stateReasonColumn)}
        state={getCellValueByColumn(record, stateColumn)}
        stateColumn={stateColumn}
        column={stateReasonColumn}
        onChange={onChange}
      />
      <TypeSettings
        id="github-issue-type-editor-popover"
        isReadonly={isReadonly}
        value={getCellValueByColumn(record, typeColumn)}
        column={typeColumn}
        onChange={onChange}
      />
      <LinkedTicket
        ticketID={getCellValueByColumn(record, linkedTicketColumn)}
        title={linkedTicketTitle}
        projectUuid={projectUuid}
        isReadonly={isReadonly}
        linkedTicketTools={linkedTicketTools}
      />
    </>
  );
};

export default GitHubIssuesDetails;
