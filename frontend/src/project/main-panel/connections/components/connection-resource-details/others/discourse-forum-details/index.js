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
        onChange={(newValue) => onChange({ [resolvedColumn.name]: newValue })}
      />
      <LinkedTicket
        ticketID={getCellValueByColumn(record, linkedTicketColumn)}
        title={linkedTicketTitle}
        projectUuid={projectUuid}
      />
    </>
  );
};

export default DiscourseForumDetails;
