import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connectionsAPI } from '@/project/api';
import context from '@/sea-metadata/context';
import User from '@/models/user';

// hooks
import { useConnections } from '../../main-panel/connections/hooks';
import { useData, useMetadata, useTags } from '@/project/hooks';

// components
import { toaster } from '@/components';
import ConnectionResourceDetails, { ConnectionResourceOtherDetails } from '../../main-panel/connections/components/connection-resource-details';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';

// utils
import { Utils } from '@/utils/utils';
import { formatColumns, generateCreateRelatedTicketOption, generateLinkAnExistingTicketOption, getTableName, } from '../../main-panel/connections/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';

// constants
import { PERMISSION_TYPES } from '@/constants';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES, CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE, } from '../../main-panel/connections/constants';
import { CellType, EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';

const ConnectionDetails = ({ projectUuid, resource, columns, permission, onUpdateResourceDetails }) => {
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const { connections } = useConnections();
  const { modifyRow, modifyRowLink, insertRowByLink } = useData();
  const { tagsData } = useTags();
  const linkedTicketTitle = useRef('');

  const connection = useMemo(() => {
    return connections.find(c => c.id === resource?.connection_id);
  }, [connections, resource?.connection_id]);

  useEffect(() => {
    setConnectionDetails(null);
    linkedTicketTitle.current = '';
  }, [resource?._id, resource?.connection_id]);

  const updateResourceDetails = useCallback(({ record, columns, linked_ticket_title, related_users }) => {
    linkedTicketTitle.current = linked_ticket_title || '';
    const details = { record, columns, linked_ticket_title, related_users };
    setConnectionDetails(details);
    onUpdateResourceDetails && onUpdateResourceDetails(record);
  }, [onUpdateResourceDetails]);

  const targetColumns = useMemo(() => {
    if (!connection || !connectionDetails?.columns) return [];
    const relatedUsers = Array.isArray(connectionDetails.related_users) ? connectionDetails.related_users : [];
    const collaborators = relatedUsers.map(user => new User(user));
    return formatColumns(connection, connectionDetails.columns, { collaborators });
  }, [connection, connectionDetails]);

  const rowForActions = useMemo(() => {
    if (!connectionDetails?.record || !connection) return null;
    return {
      ...connectionDetails.record,
      _id: resource?._id + '',
      _pk: resource?._id
    };
  }, [connectionDetails, connection, resource]);

  const handleOthersChange = useCallback((update, callback) => {
    if (!connection || !connectionDetails?.record || targetColumns.length === 0) return;

    const recordID = Number(resource._id);
    const tableName = getTableName(connection);
    let localRowUpdate = {};
    Object.keys(update).forEach((name) => {
      const column = getColumnByName(targetColumns, name);
      if (!column) return;
      if (column.type === CellType.SINGLE_SELECT) {
        const value = getCellValueByColumn(update, column);
        if (value) {
          const options = getColumnOptions(column);
          const option = getOption(options, value);
          localRowUpdate[column.key] = option?.id || null;
        } else {
          localRowUpdate[column.key] = null;
        }
        return;
      }
      localRowUpdate[column.key] = getCellValueByColumn(update, column, { tagsData });
    });

    modifyRow(tableName, recordID, localRowUpdate, () => {
      const request = connection.type === CONNECTION_TYPE.GITHUB_ISSUE
        ? connectionsAPI.modifyGithubIssue(projectUuid, connection.id, recordID, update)
        : connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, recordID, update);

      return request.then((res) => {
        if (Object.prototype.hasOwnProperty.call(update, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET)) {
          linkedTicketTitle.current = '';
        }
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, recordID, localRowUpdate);
        setConnectionDetails((current) => current ? {
          ...current,
          linked_ticket_title: Object.prototype.hasOwnProperty.call(update, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET)
            ? ''
            : current.linked_ticket_title,
          record: { ...current.record, ...update },
        } : current);
        onUpdateResourceDetails && onUpdateResourceDetails({ ...connectionDetails.record, ...update });
        callback && callback();
        return res;
      }).catch((error) => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
        throw error;
      });
    });
  }, [connection, connectionDetails, targetColumns, tagsData, modifyRow, projectUuid, resource?._id, onUpdateResourceDetails]);

  const createTicketCallback = useCallback((ticket) => {
    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const linkColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    if (!linkColumn) return;

    const rowId = resource._id;
    const nextRecordUpdate = { [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket._pk };
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };

    insertRowByLink(TICKET_TABLE_NAME, getTableName(connection), linkedUpdateRecord, rowId, rowUpdateData, () => {
      linkedTicketTitle.current = ticket.title;
      setConnectionDetails((current) => current ? {
        ...current,
        linked_ticket_title: ticket.title,
        record: { ...current.record, ...nextRecordUpdate },
      } : current);
      onUpdateResourceDetails && onUpdateResourceDetails({ ...connectionDetails.record, ...nextRecordUpdate });
      const eventBus = context.eventBus;
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdateData);
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
    });
  }, [connection, connectionDetails, targetColumns, insertRowByLink, resource?._id, onUpdateResourceDetails]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    if (!connection || !connectionDetails?.record) return;
    const linkedTicketColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const titleColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.TITLE);
    if (!linkedTicketColumn || !titleColumn) return;
    const rowId = connectionDetails.record._id;
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const nextRecordUpdate = { [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket.id };
    const connectionLinkedUpdate = { [ticket.id]: ticket.title };

    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`${connection.id}_${rowId}`] },
      linkedRecords: { [`${connection.id}_${rowId}`]: getCellValueByColumn(connectionDetails.record, titleColumn) }
    }, {
      tableName: getTableName(connection),
      rowId,
      rowUpdate,
      linkedRecords: connectionLinkedUpdate,
    }, () => {
      return connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, rowId, { [linkedTicketColumn.name]: ticket.id }).then((res) => {
        linkedTicketTitle.current = ticket.title;
        setConnectionDetails((current) => current ? {
          ...current,
          linked_ticket_title: ticket.title,
          record: { ...current.record, ...nextRecordUpdate },
        } : current);
        onUpdateResourceDetails && onUpdateResourceDetails({ ...connectionDetails.record, ...nextRecordUpdate });
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: connectionLinkedUpdate }, false);
        callback && callback();
        return res;
      }).catch((error) => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
        throw error;
      });
    });
  }, [connection, connectionDetails, targetColumns, modifyRowLink, projectUuid, onUpdateResourceDetails]);

  const linkedTicketTools = useMemo(() => {
    if (!rowForActions || !connection || targetColumns.length === 0 || permission !== PERMISSION_TYPES.READ_WRITE) return [];
    return [
      generateCreateRelatedTicketOption({ row: rowForActions, columns: targetColumns, connection }, () => setTicketDialogOpen(true)),
      generateLinkAnExistingTicketOption({ row: rowForActions, columns: targetColumns, connection }, () => setIsShowTicketsDialog(true)),
    ].filter(Boolean);
  }, [rowForActions, permission, targetColumns, connection]);

  return (
    <>
      <div className="seaqa-resource-connection-details-dialog-body">
        <div className="seaqa-resource-connection-details-dialog-main">
          <ConnectionResourceDetails
            resource={resource}
            columns={columns}
            projectUuid={projectUuid}
            permission={permission}
            updateResource={updateResourceDetails}
          />
        </div>
        {SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES.includes(resource?.type) && connection && connectionDetails?.record && (
          <div className="seaqa-resource-connection-details-dialog-others">
            <ConnectionResourceOtherDetails
              connection={connection}
              record={connectionDetails.record}
              columns={targetColumns}
              projectUuid={projectUuid}
              linkedTicketTitle={connectionDetails.linked_ticket_title || linkedTicketTitle.current}
              tagsData={tagsData}
              onChange={handleOthersChange}
              isReadonly={permission === PERMISSION_TYPES.READ_ONLY}
              linkedTicketTools={linkedTicketTools}
            />
          </div>
        )}
      </div>
      {isTicketDialogOpen && rowForActions && connection && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={{ _id: resource._id }}
          linkedRecordPrefix={connection.id}
          useMetadataContext={useMetadata}
          onClose={() => setTicketDialogOpen(false)}
          convertToTicket={() => connectionsAPI.convertRecordToTicket(projectUuid, connection.id, resource._id)}
          onSubmitCallback={createTicketCallback}
        />
      )}
      {isShowTicketsDialog && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={() => setIsShowTicketsDialog(false)}
        />
      )}
    </>
  );
};

export default ConnectionDetails;
