import React from 'react';
import { useMetadata } from '@/project/hooks';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { CustomerSettings } from '@/project/main-panel/tickets/components/ticket-settings';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import LinkedTicket from '../linked-ticket';

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
  const customerColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.CUSTOMER_ID);
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
      <CustomerSettings
        id="customer-editor-popover"
        isReadonly={isReadonly}
        value={getCellValueByColumn(record, customerColumn)}
        useMetadataContext={useMetadata}
        onChange={(customerId) => onChange({
          [CONNECTION_PREDEFINED_COLUMN_NAME.CUSTOMER_ID]:
            customerId === null || customerId === undefined ? '' : String(customerId),
        })}
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
