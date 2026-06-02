import { useCallback, useState, useMemo, useRef } from 'react';
import classnames from 'classnames';
import { Modal, ModalBody, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { CustomizeDropdownMenu, ModalHeader, IconTooltip, IconButton, toaster } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { Utils } from '@/utils/utils';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES, SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES, CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE } from '../../main-panel/connections/constants';
import { getColumnByName, getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { useConnections } from '../../main-panel/connections/hooks';
import { useData, useMetadata, useTags } from '@/project/hooks';
import ConnectionResourceDetails, { ConnectionResourceOtherDetails } from '../../main-panel/connections/components/connection-resource-details';
import { getInternalNetworkAddress, getResourceIconURL, getResourceOriginalURL } from '@/project/utils';
import { KBInDialog } from '../../main-panel/knowledge-base/components';
import TicketInDialog from '../../main-panel/tickets/components/ticket-in-dialog';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { PORTAL_ISSUE_TYPE } from '@/project/main-panel/portal-issues/constants';
import { portalAPI } from '@/portal/api';
import { CellType, EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { formatColumns, generateCreateRelatedTicketOption, generateLinkAnExistingTicketOption, getTableName } from '../../main-panel/connections/utils';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { connectionsAPI } from '@/project/api';
import context from '@/sea-metadata/context';
import User from '@/models/user';

import './index.css';

const { projectName, workspaceID } = window.app.pageOptions;

const initColumns = [
  { key: 'filename', name: 'filename' },
  { key: 'path', name: 'path' },
  { key: 'title', name: 'title' },
  { key: 'url', name: 'url' },
  { key: 'slug', name: 'slug' },
  { key: 'topic_id', name: 'topic_id' },
  { key: 'page_id', name: 'page_id' },
];

const ResourceDetailsDialog = ({
  projectUuid, resource, columns = initColumns, isShowIcon, permission = 'r',
  switchResource, onToggle,
  createMoreOptions,
  getTicket,
  getKB,
  getIssue = (projectUuid, issueID) => portalAPI.getPortalIssue(projectUuid, issueID),
}) => {
  const type = useMemo(() => resource?.type, [resource]);

  const [resourceDetails, setResourceDetails] = useState(null);
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const { connections } = useConnections();
  const { modifyRow, modifyRowLink, insertRowByLink } = useData();
  const { tagsData } = useTags();
  const linkedTicketTitle = useRef('');
  const connection = useMemo(() => connections.find(c => c.id === resource?.connection_id), [connections, resource?.connection_id]);

  const title = useMemo(() => {

    // connection
    if (resourceDetails && resourceDetails.title) return resourceDetails.title;
    const titleColumn = getColumnByName(columns, 'title');
    let title = getCellValueByColumn(resource, titleColumn);
    if (!title && type === CONNECTION_TYPE.SEAFILE) {
      const filenameColumn = getColumnByName(columns, 'filename');
      title = getCellValueByColumn(resource, filenameColumn);
    }
    return title;
  }, [resource, resourceDetails, columns]);

  const url = useMemo(() => {
    return getResourceOriginalURL(type, { ...resource, ...resourceDetails, url: resourceDetails?.url }, connections, columns);
  }, [type, connections, resource, resourceDetails, columns]);

  const internalNetworkAddress = useMemo(() => {
    return getInternalNetworkAddress(type, resource._id, { workspaceID, projectName, connectionID: resource.connection_id });
  }, [type, resource]);

  const handleSwitchResource = Utils.debounce(useCallback((step) => {
    switchResource(step);
  }, [switchResource]), 300);

  const updateResourceDetails = useCallback(({ record, columns, linked_ticket_title, related_users }) => {
    linkedTicketTitle.current = linked_ticket_title || '';
    setConnectionDetails({ record, columns, linked_ticket_title, related_users });
    setResourceDetails(record);
  }, []);

  const handleUpdateTicket = useCallback((ticket) => {
    setResourceDetails(ticket);
  }, []);

  const handleUpdateIssue = useCallback((issue) => {
    setResourceDetails(issue);
  }, []);

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
      connection_id: connection.id,
      type: connection.type,
    };
  }, [connectionDetails, connection]);

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
        setResourceDetails((current) => current ? { ...current, ...update } : current);
        callback && callback();
        return res;
      }).catch((error) => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
        throw error;
      });
    });
  }, [connection, connectionDetails, targetColumns, tagsData, modifyRow, projectUuid]);

  const createTicketCallback = useCallback((ticket) => {
    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const linkColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, getTableName(connection), linkedUpdateRecord, resource._id, rowUpdateData, () => {
      linkedTicketTitle.current = ticket.title;
      setConnectionDetails((current) => current ? {
        ...current,
        linked_ticket_title: ticket.title,
        record: { ...current.record, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket._pk },
      } : current);
      setResourceDetails((current) => current ? { ...current, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket._pk } : current);
      const eventBus = context.eventBus;
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, connectionDetails.record._id, rowUpdateData);
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
    });
  }, [connection, connectionDetails, targetColumns, insertRowByLink]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    if (!connection || !connectionDetails?.record) return;
    const linkedTicketColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const titleColumn = getColumnByName(targetColumns, CONNECTION_PREDEFINED_COLUMN_NAME.TITLE);
    if (!linkedTicketColumn || !titleColumn) return;
    const rowId = connectionDetails.record._id;
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
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
          record: { ...current.record, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket.id },
        } : current);
        setResourceDetails((current) => current ? { ...current, [CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET]: ticket.id } : current);
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
  }, [connection, connectionDetails, targetColumns, modifyRowLink, projectUuid]);

  const linkedTicketTools = useMemo(() => {
    if (!rowForActions || !connection || targetColumns.length === 0 || permission !== PERMISSION_TYPES.READ_WRITE) return [];
    return [
      generateCreateRelatedTicketOption({ row: rowForActions, columns: targetColumns, connection }, () => setTicketDialogOpen(true)),
      generateLinkAnExistingTicketOption({ row: rowForActions, columns: targetColumns, connection }, () => setIsShowTicketsDialog(true)),
    ].filter(Boolean);
  }, [rowForActions, permission, targetColumns, connection]);

  return (
    <Modal className="seaqa-resource-details-dialog" isOpen={true} toggle={onToggle} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onToggle}>
        <div className="d-flex align-items-center">
          {switchResource && (
            <div className="row-expand-direct-icons user-select-none mr-2">
              <IconTooltip
                icon="arrow-down"
                tip={gettext('Previous record')}
                className="direct-icon rotate-icon-180"
                placement="bottom"
                onClick={() => handleSwitchResource(-1)}
              />
              <IconTooltip
                icon="arrow-down"
                tip={gettext('Next record')}
                className="direct-icon"
                placement="bottom"
                onClick={() => handleSwitchResource(1)}
              />
            </div>
          )}
          {isShowIcon && (
            <div className="seaqa-resource-type-avatar mr-2">
              <img src={getResourceIconURL(type)} alt={''} />
            </div>
          )}
          <div className="text-truncate" title={title}>{title}</div>
          {internalNetworkAddress && (
            <IconButton
              className="open-in-new-tab-btn"
              icon="view-issue"
              title={gettext('Open the record in a new tab')}
              onClick={() => window.open(internalNetworkAddress, '_blank', 'noopener,noreferrer')}
            />
          )}
          {url && (
            <IconButton
              className="open-in-new-tab-btn"
              icon="open-in-new-tab"
              title={gettext('Open the source address in a new tab')}
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            />
          )}
        </div>
        {createMoreOptions && (
          <Dropdown className="ticket-create-more-options-dropdown" isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
            <DropdownToggle tag="span">
              <IconButton className="more-btn" icon="more" title={gettext('More')}/>
            </DropdownToggle>
            <CustomizeDropdownMenu>
              {createMoreOptions(resource).map((option, index) => {
                if (option === 'Divider') {
                  return <DropdownItem key={index} divider />;
                }
                return (
                  <DropdownItem key={option.key} onClick={() => { option.callback && option.callback(); setIsMoreMenuOpen(false); }}>
                    {option.label}
                  </DropdownItem>
                );
              })}
            </CustomizeDropdownMenu>
          </Dropdown>
        )}
      </ModalHeader>
      <ModalBody>
        {SUPPORT_ROW_DETAILS_CONNECTION_TYPES.includes(type) && (
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
            {SUPPORT_ROW_DETAILS_SETTINGS_CONNECTION_TYPES.includes(type) && connection && connectionDetails?.record && (
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
        )}
        {type === KNOWLEDGE_BASE_TYPE && (
          <KBInDialog projectUuid={projectUuid} knowledgeID={resource._id} updateKB={(kb) => setResourceDetails(kb)} getKB={getKB} />
        )}
        {type === TICKET_TYPE && (
          <TicketInDialog projectUuid={projectUuid} columns={columns} ticketID={resource._id} updateTicket={handleUpdateTicket} getTicket={getTicket} />
        )}
        {type === PORTAL_ISSUE_TYPE && (
          <TicketInDialog projectUuid={projectUuid} columns={columns} ticketType={PORTAL_ISSUE_TYPE} ticketID={resource._id} updateTicket={handleUpdateIssue} getTicket={getIssue} />
        )}
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
      </ModalBody>
    </Modal>
  );
};

export default ResourceDetailsDialog;
