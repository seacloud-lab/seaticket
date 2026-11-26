import React, { useState, useCallback, useRef } from 'react';
import { toaster } from '@/components';
import { PERMISSION_TYPES } from '@/constants';
import { portalAPI } from '@/portal/api';
import { connectionsAPI } from '@/project/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData, useMetadata } from '@/project/hooks';
import { LinkTicketContext } from '@/project/hooks/link-ticket';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { generateCreateRelatedTicketOption, generateLinkAnExistingTicketOption, getTableName } from '@/project/main-panel/connections/utils';
import { PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_TYPE, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME } from '@/project/main-panel/portal-issues/constants';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { generateRowKey } from '@/sea-metadata/utils/row';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';

export const useLinkTicketWorkflow = ({ projectUuid }) => {
  const [operation, setOperation] = useState(null);
  const operationId = useRef(0);
  const { modifyRowLink, insertRowByLink } = useData();

  const openDialog = useCallback((kind, { row, columns, connection }) => {
    const sourceId = row?._pk ?? row?._id ?? row?.id;
    if (sourceId == null) return;
    const linkColumnName = connection ? CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET;
    const linkColumn = getColumnByName(columns, linkColumnName);
    if (!linkColumn) return;
    const rowId = String(sourceId);
    setOperation({
      kind,
      operationId: ++operationId.current,
      row,
      rowId,
      dialogRow: { _id: rowId },
      columns,
      connection,
      linkColumn,
      tableName: connection ? getTableName(connection) : PORTAL_ISSUE_TABLE_NAME,
      linkedRecordPrefix: connection ? connection.id : 'portal',
    });
  }, []);

  const createTicket = useCallback((params) => openDialog('create', params), [openDialog]);
  const linkAnExistingTicket = useCallback((params) => openDialog('link', params), [openDialog]);

  const closeDialog = useCallback((targetOperationId) => {
    setOperation(current => current?.operationId === targetOperationId ? null : current);
  }, []);

  const notifyLinkedTicket = useCallback((target, ticket) => {
    const { rowId, tableName, linkColumn, connection } = target;
    const rowUpdate = { [linkColumn.name]: ticket._pk };
    const linkedRecords = { [ticket._pk]: ticket.title };
    const linkedRowUpdate = { [ticket._pk]: { title: ticket.title } };
    const resourceKey = generateRowKey(connection ? tableName : PORTAL_ISSUE_TYPE, rowId);
    eventBus.dispatch(EVENT_BUS_TYPE.TICKET_LINKED, {
      projectUuid,
      tableName,
      rowId,
      rowUpdate,
      rowUpdateData: { [linkColumn.key]: [ticket._pk] },
      linkedRecords,
      ticket,
    });
    eventBus.dispatch(EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, resourceKey, rowUpdate, linkedRowUpdate);
  }, [projectUuid]);

  const createTicketCallback = useCallback((result) => {
    const ticket = { ...result, _pk: result._pk ?? result.id };
    const { rowId, tableName, linkColumn } = operation;
    insertRowByLink(
      TICKET_TABLE_NAME, tableName, { [ticket._pk]: ticket.title }, rowId,
      { [linkColumn.key]: [ticket._pk] },
      () => notifyLinkedTicket(operation, ticket),
    );
  }, [operation, insertRowByLink, notifyLinkedTicket]);

  const linkAnExistingTicketCallback = useCallback((result, linkedRowColumn, callback) => {
    const ticket = { ...result, _pk: result._pk ?? result.id };
    const { columns, rowId, row, connection, linkedRecordPrefix, linkColumn, tableName } = operation;
    const linkedRecordKey = `${linkedRecordPrefix}_${rowId}`;
    const titleColumnName = connection ? CONNECTION_PREDEFINED_COLUMN_NAME.TITLE : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TITLE;
    const rowTitle = getCellValueByColumn(row, getColumnByName(columns, titleColumnName));
    const rowUpdate = { [linkColumn.name]: ticket._pk };
    const linkedRecords = { [linkedRecordKey]: rowTitle };
    const stateColumnName = connection ? CONNECTION_PREDEFINED_COLUMN_NAME.STATE : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE;
    const linkedRecordsInfo = { [linkedRecordKey]: {
      _pk: rowId,
      title: rowTitle,
      connection_type: connection ? connection.type : PORTAL_ISSUE_TYPE,
      state: getCellValueByColumn(row, getColumnByName(columns, stateColumnName)),
    } };
    const appendLink = value => Array.from(new Set([...(Array.isArray(value) ? value : []), linkedRecordKey]));

    return modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket._pk),
      rowUpdate: { [linkedRowColumn.key]: [linkedRecordKey] },
      linkedRecords,
    }, {
      tableName,
      rowId,
      rowUpdate: { [linkColumn.key]: [ticket._pk] },
      linkedRecords: { [ticket._pk]: ticket.title },
    }, () => connection
      ? connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, rowId, rowUpdate)
      : portalAPI.modifyPortalIssue(projectUuid, rowId, rowUpdate)
    ).then((res) => {
      notifyLinkedTicket(operation, ticket);
      eventBus.dispatch(EVENT_BUS_TYPE.TICKET_LINKED, {
        projectUuid,
        tableName: TICKET_TABLE_NAME,
        rowId: String(ticket._pk),
        // Merge against each consumer's latest state, including concurrent links.
        rowUpdateData: current => ({ [linkedRowColumn.key]: appendLink(getCellValueByColumn(current, linkedRowColumn)) }),
        updateTicket: current => ({ linked_connection_records: appendLink(current?.linked_connection_records) }),
        linkedRecords,
        linkedRecordsInfo,
      });
      callback && callback();
      return res;
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      callback && callback(true);
    });
  }, [projectUuid, operation, modifyRowLink, notifyLinkedTicket]);

  const convertToTicket = useCallback(() => {
    const { connection, rowId } = operation;
    return connection
      ? connectionsAPI.convertRecordToTicket(projectUuid, connection.id, rowId)
      : portalAPI.convertPortalIssueToTicket(projectUuid, rowId);
  }, [projectUuid, operation]);

  const generateConnectionLinkTicketOptions = useCallback(({ permission, ...props }) => {
    if (!props.row || permission !== PERMISSION_TYPES.READ_WRITE) return [];
    return [
      generateCreateRelatedTicketOption(props, () => createTicket(props)),
      generateLinkAnExistingTicketOption(props, () => linkAnExistingTicket(props)),
    ].filter(Boolean);
  }, [createTicket, linkAnExistingTicket]);

  return {
    value: { createTicket, linkAnExistingTicket, generateConnectionLinkTicketOptions },
    dialogs: (
      <>
        {operation?.kind === 'create' && (
          <CreateTicketDialog
            key={operation.operationId}
            projectUuid={projectUuid}
            row={operation.dialogRow}
            linkedRecordPrefix={operation.linkedRecordPrefix}
            useMetadataContext={useMetadata}
            onClose={() => closeDialog(operation.operationId)}
            convertToTicket={convertToTicket}
            onSubmitCallback={createTicketCallback}
          />
        )}
        {operation?.kind === 'link' && (
          <TicketsDialog
            key={operation.operationId}
            projectUuid={projectUuid}
            onSubmit={linkAnExistingTicketCallback}
            onToggle={() => closeDialog(operation.operationId)}
          />
        )}
      </>
    ),
  };
};

export const LinkTicketProvider = ({ children, ...props }) => {
  const { value, dialogs } = useLinkTicketWorkflow(props);
  return <LinkTicketContext.Provider value={value}>{children}{dialogs}</LinkTicketContext.Provider>;
};
