import React from 'react';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

const DiscourseForumDetails = ({
  record,
  columns,
  permission,
  linkedTicketTitle,
  projectUuid,
  tagsData,
  onChange,
}) => {
  const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);

  return (
    <>
      
      <LinkedTicket
        ticketID={getCellValueByColumn(record, linkedTicketColumn)}
        title={linkedTicketTitle}
        projectUuid={projectUuid}
      />
    </>
  );
};

export default DiscourseForumDetails;
