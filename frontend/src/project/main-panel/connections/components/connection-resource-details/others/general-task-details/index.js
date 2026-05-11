import React from 'react';
import { gettext } from '@/constants';
import { CustomizeLabel } from '@/components';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';

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
  const dueDateColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.DUE_DATE);
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);

  return (
    <>
      {renderStaticItem(gettext('Status'), getCellValueByColumn(record, statusColumn))}
      {renderStaticItem(gettext('Priority'), getCellValueByColumn(record, priorityColumn))}
      {renderStaticItem(gettext('Size'), getCellValueByColumn(record, sizeColumn))}
      {renderStaticItem(gettext('Assignees'), getCellValueByColumn(record, assigneesColumn))}
      {renderStaticItem(gettext('Participants'), getCellValueByColumn(record, participantsColumn))}
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
