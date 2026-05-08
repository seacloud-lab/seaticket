import React from 'react';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import CheckboxSettings from '../checkbox-settings';
import { gettext } from '@/constants';

const DiscourseForumDetails = ({
  record,
  columns,
  isReadonly,
  linkedTicketTitle,
  projectUuid,
  linkedTicketTools,
  onChange,
}) => {
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
  const resolvedColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.RESOLVED);

  return (
    <>
      <CheckboxSettings
        isReadonly={true}
        title={gettext('Resolved')}
        className="mb-4"
        value={getCellValueByColumn(record, resolvedColumn)}
        onChange={(newValue, callback) => onChange({ [resolvedColumn.name]: newValue }, callback)}
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

export default DiscourseForumDetails;
