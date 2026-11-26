import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { toaster } from '@/components';
import { PERMISSION_TYPES } from '@/constants';
import User from '@/models/user';
import { connectionsAPI } from '@/project/api';
import { useData, useTags } from '@/project/hooks';
import { useLinkedTicketUpdate, useLinkTicket } from '@/project/hooks/link-ticket';
import { useResourceUpdate } from '@/project/hooks/resource-dialog';
import { CellType, EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import context from '@/sea-metadata/context';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { isSmallContainer } from '@/utils/dialog';
import { Utils } from '@/utils/utils';
import { SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES, CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE, } from '../../constants';
import { useConnections } from '../../hooks';
import { formatColumns, getTableName, } from '../../utils';
import ConnectionResourceDetails, { ConnectionResourceOtherDetails } from '../connection-resource-details';

import './index.css';

const ConnectionRecordDetailsInDialog = ({ projectUuid, resource, columns, permission, highlight, onUpdateResourceDetails }) => {
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { connections } = useConnections();
  const { modifyRow, modifyLocalRow } = useData();
  const { tagsData } = useTags();
  const { generateConnectionLinkTicketOptions } = useLinkTicket();

  const detailsRef = useRef(null);
  const resizeObserverRef = useRef(null);
  // null means details have loaded; otherwise collect updates until they arrive.
  const pendingDetailsRef = useRef({});

  const connection = useMemo(() => connections.find(c => c.id === resource?.connection_id), [connections, resource?.connection_id]);
  const connectionTableName = useMemo(() => connection ? getTableName(connection) : '', [connection]);

  useEffect(() => {
    pendingDetailsRef.current = {};
    setConnectionDetails(null);
  }, [resource?._id, resource?.connection_id]);

  const updateResourceDetails = useCallback(({ record, columns, linked_ticket_title, related_users }) => {
    const pending = pendingDetailsRef.current;
    const details = {
      columns, linked_ticket_title, related_users,
      ...pending,
      record: { ...record, ...pending?.record },
    };
    pendingDetailsRef.current = null;
    setConnectionDetails(details);
    onUpdateResourceDetails && onUpdateResourceDetails(details);
  }, [onUpdateResourceDetails]);

  const targetColumns = useMemo(() => {
    if (!connection || !connectionDetails?.columns) return [];
    const relatedUsers = Array.isArray(connectionDetails.related_users) ? connectionDetails.related_users : [];
    const collaborators = relatedUsers.map(user => new User(user));
    return formatColumns(connection, connectionDetails.columns, { collaborators });
  }, [connection, connectionDetails]);

  const syncRecordDetails = useCallback((recordUpdate = {}, linkedTicketTitle) => {
    if (pendingDetailsRef.current) {
      const pending = pendingDetailsRef.current;
      pending.record = { ...pending.record, ...recordUpdate };
      if (linkedTicketTitle !== undefined) pending.linked_ticket_title = linkedTicketTitle;
      return;
    }
    setConnectionDetails((current) => {
      if (!current) return current;
      const nextDetails = {
        ...current,
        linked_ticket_title: linkedTicketTitle !== undefined ? linkedTicketTitle : current.linked_ticket_title,
        record: { ...current.record, ...recordUpdate },
      };
      onUpdateResourceDetails && onUpdateResourceDetails(nextDetails);
      return nextDetails;
    });
  }, [onUpdateResourceDetails]);

  useLinkedTicketUpdate({
    projectUuid,
    tableName: connectionTableName,
    rowId: resource?._id,
    onUpdate: ({ rowUpdate, ticket }) => syncRecordDetails(rowUpdate, ticket.title),
  });

  useResourceUpdate({ projectUuid, tableName: connectionTableName, rowId: resource?._id, onUpdate: ({ rowUpdate }) => {
    if (rowUpdate) syncRecordDetails(rowUpdate);
  } });

  const handleThreadUnreadChange = useCallback((nextUnread) => {
    if (!connection || connection.type !== CONNECTION_TYPE.EMAIL) return;

    const availableColumns = targetColumns.length > 0 ? targetColumns : columns;
    const unreadColumn = getColumnByName(availableColumns, CONNECTION_PREDEFINED_COLUMN_NAME.UNREAD);
    if (!unreadColumn) return;

    if (connectionDetails?.record) {
      const currentUnread = Boolean(getCellValueByColumn(connectionDetails.record, unreadColumn));
      if (currentUnread === nextUnread) return;
    }

    const rowId = resource._id;
    const localRowUpdate = { [unreadColumn.key]: nextUnread };
    modifyLocalRow(connectionTableName, rowId, localRowUpdate);
    context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, localRowUpdate);
    syncRecordDetails({ [unreadColumn.name]: nextUnread });
  }, [connection, connectionDetails, targetColumns, columns, resource?._id, modifyLocalRow, connectionTableName, syncRecordDetails]);

  const handleOthersChange = useCallback((update, callback) => {
    if (!connection || !connectionDetails?.record || targetColumns.length === 0) return;

    let localRowUpdate = {};
    const recordID = Number(resource._id);
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

    modifyRow(connectionTableName, recordID, localRowUpdate, () => {
      const request = connection.type === CONNECTION_TYPE.GITHUB_ISSUE
        ? connectionsAPI.modifyGithubIssue(projectUuid, connection.id, recordID, update)
        : connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, recordID, update);

      return request.then((res) => {
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, recordID, localRowUpdate);
        syncRecordDetails(
          update,
          Object.prototype.hasOwnProperty.call(update, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET) ? '' : undefined
        );
        callback && callback();
        return res;
      }).catch((error) => {
        const errorMessage = error?.response?.status === 404 && error?.response?.data?.error_msg === 'Installation_id is incorrect'
          ? 'The GitHub app is missing or has been uninstalled. Please reinstall it.'
          : Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
        throw error;
      });
    });
  }, [connection, targetColumns, tagsData, modifyRow, projectUuid, resource?._id, connectionTableName, connectionDetails, syncRecordDetails]);

  const linkedTicketTools = useMemo(() => {
    if (!connectionDetails?.record) return [];
    const row = { ...connectionDetails.record, _id: resource?._id + '', _pk: resource?._id };

    const params = { row, columns: targetColumns, connection, permission };
    return generateConnectionLinkTicketOptions(params);
  }, [
    connection, connectionDetails, permission, targetColumns, resource,
    generateConnectionLinkTicketOptions
  ]);

  useEffect(() => {
    const dom = detailsRef.current;
    if (!dom) return;

    try {
      // Check if ResizeObserver is supported
      if (typeof ResizeObserver === 'undefined') {
        // eslint-disable-next-line no-console
        console.warn('ResizeObserver is not supported in this browser');
        // Fallback: set initial width
        setContainerWidth(dom.offsetWidth);
        return;
      }

      const handleResize = () => {
        if (!dom) return;
        try {
          setContainerWidth(dom.offsetWidth);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error updating container width:', error);
        }
      };

      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(dom);

      // initial width
      handleResize();

      return () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error setting up ResizeObserver:', error);
      // Fallback: set width directly
      setContainerWidth(dom.offsetWidth);
    }
  }, []);

  const isSmallSize = isSmallContainer(containerWidth);

  return (
    <div className={classnames('seaqa-connection-record-details-in-dialog', { 's': isSmallSize })} ref={detailsRef}>
      <div className="seaqa-connection-record-details-in-dialog-main">
        <ConnectionResourceDetails
          resource={resource}
          columns={columns}
          projectUuid={projectUuid}
          permission={permission}
          highlight={highlight}
          isSmallScreen={isSmallSize}
          updateResource={updateResourceDetails}
          onThreadUnreadChange={handleThreadUnreadChange}
        />
      </div>
      {SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES.includes(resource?.type) && connectionDetails?.record && (
        <div className="seaqa-connection-record-details-in-dialog-others">
          <ConnectionResourceOtherDetails
            connection={connection}
            record={connectionDetails.record}
            columns={targetColumns}
            projectUuid={projectUuid}
            linkedTicketTitle={connectionDetails.linked_ticket_title || ''}
            tagsData={tagsData}
            onChange={handleOthersChange}
            isReadonly={permission === PERMISSION_TYPES.READ_ONLY}
            linkedTicketTools={linkedTicketTools}
          />
        </div>
      )}
    </div>
  );
};

export default ConnectionRecordDetailsInDialog;
