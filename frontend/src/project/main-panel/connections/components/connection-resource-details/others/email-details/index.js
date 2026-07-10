import React from 'react';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import TagsSettings from '@/project/main-panel/tags/tags-settings';

const EmailDetails = ({
  record,
  columns,
  isReadonly,
  linkedTicketTitle,
  projectUuid,
  tagsData,
  linkedTicketTools,
  onChange,
}) => {
  const tagsColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.TAGS);
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);

  return (
    <>
      <TagsSettings
        id="tags-editor-popover"
        isReadonly={isReadonly}
        value={getCellValueByColumn(record, tagsColumn)}
        tagsData={tagsData}
        onChange={(newValue) => onChange({ [CONNECTION_PREDEFINED_COLUMN_NAME.TAGS]: newValue })}
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

export default EmailDetails;
