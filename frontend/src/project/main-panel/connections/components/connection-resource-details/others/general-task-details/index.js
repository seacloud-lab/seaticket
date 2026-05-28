import React, { useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import LinkedTicket from '../linked-ticket';
import {
  CollaboratorsSettings, DueDateSettings,
} from '@/project/main-panel/tickets/components/ticket-settings';
import SingleSelectSettings from '../single-select-settings';
import TextSettings from '../text-settings';

const GeneralTaskDetails = ({
  record,
  columns,
  isReadonly,
  linkedTicketTitle,
  projectUuid,
  linkedTicketTools,
  onChange,
}) => {
  const statusColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.STATUS), [columns]);
  const sizeColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.SIZE), [columns]);
  const priorityColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PRIORITY), [columns]);
  const assigneesColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.ASSIGNEES), [columns]);
  const participantsColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.PARTICIPANTS), [columns]);
  const versionColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.VERSION), [columns]);
  const dueDateColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.DUE_DATE), [columns]);
  const linkedTicketColumn = useMemo(() => getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET), [columns]);

  const onDueDateChange = useCallback((value) => {
    onChange && onChange({ [dueDateColumn.name]: value || null });
  }, [dueDateColumn, onChange]);

  const onParticipantsChange = useCallback((value) => {
    onChange && onChange({ [participantsColumn.name]: value });
  }, [participantsColumn, onChange]);

  const onAssigneesChange = useCallback((value) => {
    onChange && onChange({ [assigneesColumn.name]: value });
  }, [assigneesColumn, onChange]);

  const onStatusChange = useCallback((status) => {
    onChange && onChange({ [statusColumn.name]: status || null });
  }, [statusColumn, onChange]);

  const onPriorityChange = useCallback((priority) => {
    onChange && onChange({ [priorityColumn.name]: priority || null });
  }, [priorityColumn, onChange]);

  const onSizeChange = useCallback((size) => {
    onChange && onChange({ [sizeColumn.name]: size || null });
  }, [sizeColumn, onChange]);

  const onVersionChange = useCallback((version) => {
    onChange && onChange({ [versionColumn.name]: version || null });
  }, [versionColumn, onChange]);

  return (
    <>
      <SingleSelectSettings id="status-editor-popover" isReadonly={isReadonly} value={getCellValueByColumn(record, statusColumn)} column={statusColumn} onChange={onStatusChange} />
      <SingleSelectSettings id="priority-editor-popover" isReadonly={isReadonly} value={getCellValueByColumn(record, priorityColumn)} column={priorityColumn} onChange={onPriorityChange} />
      <SingleSelectSettings id="size-editor-popover" isReadonly={isReadonly} value={getCellValueByColumn(record, sizeColumn)} column={sizeColumn} onChange={onSizeChange} />
      <CollaboratorsSettings
        id="assignees-editor-popover"
        isReadonly={isReadonly}
        title={gettext('Assignees')}
        tip={gettext('No one assigned')}
        value={getCellValueByColumn(record, assigneesColumn) || []}
        useCollaborators={() => ({ ...assigneesColumn.data })}
        onChange={onAssigneesChange}
      />
      <CollaboratorsSettings
        isReadonly={true}
        title={gettext('Participants')}
        tip={gettext('No participants')}
        value={getCellValueByColumn(record, participantsColumn) || []}
        useCollaborators={() => ({ ...participantsColumn.data })}
        onChange={onParticipantsChange}
      />
      <TextSettings isReadonly={isReadonly} column={versionColumn} value={getCellValueByColumn(record, versionColumn) || ''} onChange={onVersionChange} />
      <DueDateSettings isReadonly={isReadonly} value={getCellValueByColumn(record, dueDateColumn)} onChange={onDueDateChange} />
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
