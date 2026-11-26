import React, { useCallback, useRef, useState } from 'react';
import deepCopy from 'deep-copy';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks';
import { TicketCreationContext } from '@/project/hooks/ticket-creation';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { getTableName } from '@/project/main-panel/connections/utils';
import CreateKBRecordDialog from '@/project/main-panel/tickets/components/create-kb-record-dialog';
import CreateTaskDialog from '@/project/main-panel/tickets/components/create-task-dialog';
import { PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME, TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { convertTicketToKb, convertTicketToTask } from '@/project/main-panel/tickets/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import eventBus from '@/utils/event-bus';

export const useTicketCreationWorkflow = ({ projectUuid, workspaceID, projectName }) => {
  const [operation, setOperation] = useState(null);
  const operationId = useRef(0);
  const { getTableByName, insertRowByLink } = useData();
  const getTableRef = useRef(getTableByName);
  getTableRef.current = getTableByName;

  const openDialog = useCallback((kind, { ticket, columns, connectionType }) => {
    const rowId = ticket?._pk ?? ticket?._id ?? ticket?.id;
    if (rowId == null) return;
    const targetColumns = columns || Object.values(getTableByName(TICKET_TABLE_NAME, null)?.key_column_map || {});
    const convertTicket = kind === 'kb' ? convertTicketToKb : convertTicketToTask;
    setOperation({
      kind,
      operationId: ++operationId.current,
      rowId: String(rowId),
      row: deepCopy(ticket),
      columns: deepCopy(targetColumns),
      ticket: deepCopy(convertTicket(ticket, targetColumns)),
      connectionType,
    });
  }, [getTableByName]);

  const createKnowledgeBaseRecord = useCallback(params => openDialog('kb', params), [openDialog]);
  const createTask = useCallback(({ connectionType = CONNECTION_TYPE.GENERAL_TASK, ...params }) => {
    openDialog('task', { ...params, connectionType });
  }, [openDialog]);

  const closeDialog = useCallback((targetOperationId) => {
    // A late submission must not close a newer operation's dialog.
    setOperation(current => current?.operationId === targetOperationId ? null : current);
  }, []);

  const handleTaskCreated = useCallback((target, { task, connection, activities = [], ticket: ticketUpdate }) => {
    const { rowId, row } = target;
    const columns = target.columns.length ? target.columns : Object.values(getTableRef.current(TICKET_TABLE_NAME, null)?.key_column_map || {});
    const linkedColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.LINKED_CONNECTION_RECORDS);
    const linkedKey = `${connection.id}_${task._pk}`;
    const linkedRecordTitles = { [linkedKey]: task.title };
    const linkedRecords = { [linkedKey]: { _pk: task._pk, title: task.title, connection_type: connection.type } };
    const update = {};
    const dialogUpdate = {};
    ['state', 'substate', 'modified_time', 'closed_time'].forEach(name => {
      if (ticketUpdate?.[name] === undefined) return;
      dialogUpdate[name] = ticketUpdate[name];
      const column = getColumnByName(columns, name);
      if (column) update[column.key] = ticketUpdate[name];
    });
    const appendLink = value => Array.from(new Set([...(Array.isArray(value) ? value : []), linkedKey]));
    // Read the latest cache/view row so overlapping creations keep both links.
    const rowUpdate = current => ({
      ...update,
      ...(linkedColumn ? { [linkedColumn.key]: appendLink(getCellValueByColumn(current || row, linkedColumn)) } : {}),
    });
    const updateTicket = current => ({
      ...dialogUpdate,
      linked_connection_records: appendLink(current?.linked_connection_records),
    });

    insertRowByLink(getTableName(connection), TICKET_TABLE_NAME, linkedRecordTitles, rowId, rowUpdate, () => {
      eventBus.dispatch(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, `${TICKET_TYPE}_${rowId}`, updateTicket, linkedRecords);
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_TASK_CREATED, {
        projectUuid, rowId, rowUpdate, updateTicket, linkedRecordTitles, linkedRecords, activities,
      });
    });
  }, [projectUuid, insertRowByLink]);

  return {
    value: { createKnowledgeBaseRecord, createTask },
    dialogs: (
      <>
        {operation?.kind === 'kb' && (
          <CreateKBRecordDialog
            key={operation.operationId}
            projectUuid={projectUuid}
            ticket={operation.ticket}
            onClose={() => closeDialog(operation.operationId)}
          />
        )}
        {operation?.kind === 'task' && (
          <CreateTaskDialog
            key={operation.operationId}
            projectUuid={projectUuid}
            workspaceID={workspaceID}
            projectName={projectName}
            ticket={operation.ticket}
            connectionType={operation.connectionType}
            onClose={() => closeDialog(operation.operationId)}
            onSubmitCallback={result => handleTaskCreated(operation, result)}
          />
        )}
      </>
    ),
  };
};

export const TicketCreationProvider = ({ children, ...props }) => {
  const { value, dialogs } = useTicketCreationWorkflow(props);
  return <TicketCreationContext.Provider value={value}>{children}{dialogs}</TicketCreationContext.Provider>;
};
