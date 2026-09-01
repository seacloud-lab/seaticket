import React, { useState, useCallback, useRef } from 'react';
import classnames from 'classnames';
import { connectionsAPI } from '@/project/api';
import context from '@/sea-metadata/context';
import { toaster } from '@/components';
import { ResourceDetailsDialog } from '@/project/components';
import RelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { useData, useMetadata } from '@/project/hooks';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { normalizeContextMenuOptions } from '@/project/utils';
import {
  generateAIOptions, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption,
  generateLinkAnExistingTicketOption, generateOpenOriginalPageOption,
  generateCopyOriginalLinkOption, generateMarkAsOutdatedOptions, getTableName,
} from '@/project/main-panel/connections/utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { Utils } from '@/utils/utils';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { TICKET_TYPE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const ResourceTitle = ({ displayDetails = true, resource, className, renderTrigger }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const actionContextRef = useRef(null);

  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();
  const { modifyRow, modifyRowLink, insertRowByLink } = useData();

  const openDetails = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    setIsShowDetails(true);
  }, []);

  const closeDetails = useCallback(() => {
    setIsShowDetails(false);
  }, []);

  const openRelatedIssuesDialog = useCallback((row, details, updateResourceDetails, columns, connection) => {
    actionContextRef.current = { row, details, updateResourceDetails, columns, connection };
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const openCreateTicketDialog = useCallback((row, details, updateResourceDetails, columns, connection) => {
    actionContextRef.current = { row, details, updateResourceDetails, columns, connection };
    setTicketDialogOpen(true);
  }, []);

  const openTicketsDialog = useCallback((row, details, updateResourceDetails, columns, connection) => {
    actionContextRef.current = { row, details, updateResourceDetails, columns, connection };
    setIsShowTicketsDialog(true);
  }, []);

  const handleResolveIssueByAI = useCallback((attachments = []) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return;
    updateAttachments(attachments.map(attachment => new AttachmentObject(attachment)));
  }, [updateAttachments]);

  const modifyRowsByDetailsMenu = useCallback((rowIds, idRowUpdates) => {
    const actionContext = actionContextRef.current;
    if (!actionContext?.connection || !actionContext?.columns || !Array.isArray(rowIds) || rowIds.length === 0) return Promise.resolve();

    const { details, updateResourceDetails, columns, connection } = actionContext;
    const rowId = rowIds[0];
    const rowUpdate = idRowUpdates?.[rowId] || {};
    const outdatedColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
    if (!outdatedColumn) return Promise.resolve();

    const serverRowUpdate = { [CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED]: getCellValueByColumn(rowUpdate, outdatedColumn) };
    const tableName = getTableName(connection);

    return modifyRow(tableName, rowId, rowUpdate, () => {
      return connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, rowId, serverRowUpdate).then((res) => {
        context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        if (updateResourceDetails && details?.record) {
          updateResourceDetails({
            ...details,
            record: { ...details.record, ...serverRowUpdate },
          });
        }
        return res;
      });
    });
  }, [modifyRow]);

  const createMoreOptions = useCallback((row, details, { columns = [], updateResourceDetails } = {}) => {
    if (!row?._id || !row?.connection_id) return [];

    const connection = connections.find(c => `${c.id}` === `${row.connection_id}`);
    if (!connection) return [];

    const options = [
      generateAIOptions({ rows: [row], columns, connection }, handleResolveIssueByAI),
      generateFindRelatedIssuesOption({ row, connection }, (targetRow) => openRelatedIssuesDialog(targetRow, details, updateResourceDetails, columns, connection)),
      generateCreateRelatedTicketOption({ row, columns, connection }, (targetRow) => openCreateTicketDialog(targetRow, details, updateResourceDetails, columns, connection)),
      generateLinkAnExistingTicketOption({ row, columns, connection }, (targetRow) => openTicketsDialog(targetRow, details, updateResourceDetails, columns, connection)),
      'Divider',
      generateOpenOriginalPageOption({ row, columns, connection }),
      generateCopyOriginalLinkOption({ row, columns, connection }),
    ];

    const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns, connection }, (...args) => {
      actionContextRef.current = { row, details, updateResourceDetails, columns, connection };
      return modifyRowsByDetailsMenu(...args);
    });
    if (markAsOutdatedOptions.length > 0) {
      options.push('Divider');
      options.push(...markAsOutdatedOptions);
    }

    return normalizeContextMenuOptions(options);
  }, [
    connections, handleResolveIssueByAI, openRelatedIssuesDialog,
    openCreateTicketDialog, openTicketsDialog, modifyRowsByDetailsMenu
  ]);

  const createTicketCallback = useCallback((ticket) => {
    const actionContext = actionContextRef.current;
    if (!actionContext?.connection || !actionContext?.columns || !actionContext?.row) return;

    const { row, details, updateResourceDetails, columns, connection } = actionContext;
    const linkColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    if (!linkColumn) return;

    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, getTableName(connection), linkedUpdateRecord, row._id, rowUpdateData, () => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, row._id, rowUpdateData);
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
      if (updateResourceDetails && details?.record) {
        updateResourceDetails({
          ...details,
          linked_ticket_title: ticket.title,
          record: { ...details.record, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket._pk },
        });
      }
    });
  }, [insertRowByLink]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const actionContext = actionContextRef.current;
    if (!actionContext?.connection || !actionContext?.columns || !actionContext?.row || !actionContext?.details?.record) return;

    const { row, details, updateResourceDetails, columns, connection } = actionContext;
    const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    if (!linkedTicketColumn) return;

    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const rowId = row._id;
    const connectionLinkedUpdate = { [ticket.id]: ticket.title };

    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`${connection.id}_${rowId}`] },
      linkedRecords: { [`${connection.id}_${rowId}`]: details.record.title },
    }, {
      tableName: getTableName(connection),
      rowId,
      rowUpdate,
      linkedRecords: connectionLinkedUpdate,
    }, () => {
      return connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, rowId, { [linkedTicketColumn.name]: ticket.id }).then((res) => {
        context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: connectionLinkedUpdate }, false);
        if (updateResourceDetails) {
          updateResourceDetails({
            ...details,
            linked_ticket_title: ticket.title,
            record: { ...details.record, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket.id },
          });
        }
        callback && callback();
        return res;
      }).catch((error) => {
        toaster.danger(Utils.getErrorMsg(error));
        callback && callback(true);
      });
    });
  }, [modifyRowLink]);

  const hasDetails = resource?.type === TICKET_TYPE || (resource?.connection_id && resource?._id);
  const canOpen = hasDetails && displayDetails;

  return (
    <>
      {renderTrigger ? renderTrigger({ openDetails, canOpen }) : (
        <div
          className={classnames(className, { 'seaqa-agent-resource-title': canOpen })}
          title={resource?.title}
          onClick={canOpen ? openDetails : () => {}}
        >
          {resource?.title}
        </div>
      )}
      {isShowDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          createMoreOptions={createMoreOptions}
          onToggle={closeDetails}
        />
      )}
      {isShowRelatedIssuesDialog && actionContextRef.current?.row && actionContextRef.current?.connection && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          row={actionContextRef.current.row}
          connectionId={actionContextRef.current.connection.id}
          onClose={() => setIsShowRelatedIssuesDialog(false)}
        />
      )}
      {isTicketDialogOpen && actionContextRef.current?.row && actionContextRef.current?.connection && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={actionContextRef.current.row}
          linkedRecordPrefix={actionContextRef.current.connection.id}
          useMetadataContext={useMetadata}
          onClose={() => setTicketDialogOpen(false)}
          convertToTicket={() => connectionsAPI.convertRecordToTicket(projectUuid, actionContextRef.current.connection.id, actionContextRef.current.row._id)}
          onSubmitCallback={createTicketCallback}
        />
      )}
      {isShowTicketsDialog && actionContextRef.current?.row && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={() => setIsShowTicketsDialog(false)}
        />
      )}
    </>
  );
};

export default ResourceTitle;
