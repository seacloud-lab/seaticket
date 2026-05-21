import React from 'react';
import { gettext } from '@/constants';
import { CustomizeLabel } from '@/components';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import {
  CONNECTION_PREDEFINED_COLUMN_NAME,
  GENERAL_TASK_STATUS_NAME_MAP,
  GENERAL_TASK_SIZE_NAME_MAP,
  GENERAL_TASK_PRIORITY_NAME_MAP,
} from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';

const getGeneralTaskDisplayValue = (value, nameMap) => {
  if (!value) return value;
  const rawValue = Array.isArray(value) ? value.join(', ') : value;
  return nameMap[rawValue] || rawValue;
};

const renderStaticItem = (title, value, className = 'mb-4') => {
  const displayValue = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className={`sea-ticket-settings-item ${className}`}>
      <CustomizeLabel>{title}</CustomizeLabel>
      <div className="tip-default">{displayValue || '--'}</div>
    </div>
  );
};

const GeneralTaskDetails = ({
  record,
  columns,
  isReadonly,
  linkedTicketTitle,
  projectUuid,
  linkedTicketTools,
}) => {
  const statusColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS);
  const sizeColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.SIZE);
  const priorityColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY);
  const assigneesColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES);
  const participantsColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PARTICIPANTS);
  const versionColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.VERSION);
  const dueDateColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.DUE_DATE);
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);

  const statusValue = getGeneralTaskDisplayValue(getCellValueByColumn(record, statusColumn), GENERAL_TASK_STATUS_NAME_MAP);
  const priorityValue = getGeneralTaskDisplayValue(getCellValueByColumn(record, priorityColumn), GENERAL_TASK_PRIORITY_NAME_MAP);
  const sizeValue = getGeneralTaskDisplayValue(getCellValueByColumn(record, sizeColumn), GENERAL_TASK_SIZE_NAME_MAP);

  return (
    <>
      {renderStaticItem(gettext('Status'), statusValue)}
      {renderStaticItem(gettext('Priority'), priorityValue)}
      {renderStaticItem(gettext('Size'), sizeValue)}
      {renderStaticItem(gettext('Assignees'), getCellValueByColumn(record, assigneesColumn))}
      {renderStaticItem(gettext('Participants'), getCellValueByColumn(record, participantsColumn))}
      {renderStaticItem(gettext('Version'), getCellValueByColumn(record, versionColumn))}
      {renderStaticItem(gettext('Due date'), getCellValueByColumn(record, dueDateColumn))}
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

export default GeneralTaskDetails;
