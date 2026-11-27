import { useCallback, useContext, useState, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Modal, ModalBody, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import copy from 'copy-to-clipboard';
import { CustomizeDropdownMenu, ModalHeader, IconTooltip, IconButton, toaster } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { portalAPI } from '@/portal/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks/data-context';
import { ResourceDialogContext, useResourceUpdate } from '@/project/hooks/resource-dialog';
import ConnectionRecordDetailsInDialog from '@/project/main-panel/connections/components/connection-record-details-in-dialog';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES, CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { getTableName } from '@/project/main-panel/connections/utils';
import { KBInDialog } from '@/project/main-panel/knowledge-base/components';
import { KB_TABLE_NAME, KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { PORTAL_ISSUE_TYPE, PORTAL_ISSUE_TABLE_NAME } from '@/project/main-panel/portal-issues/constants';
import TicketInDialog from '@/project/main-panel/tickets/components/ticket-in-dialog';
import { TICKET_TYPE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { getInternalNetworkAddress, getResourceIconURL, getResourceOriginalURL } from '@/project/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getDialogSize } from '@/utils/dialog';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';
import useMoreOptions from './use-more-options';

import './index.css';

const { projectName, workspaceID, permission: defaultPermission } = window.app?.pageOptions || {};

const initColumns = [
  { key: 'filename', name: 'filename' },
  { key: 'path', name: 'path' },
  { key: 'title', name: 'title' },
  { key: 'url', name: 'url' },
  { key: 'slug', name: 'slug' },
  { key: 'topic_id', name: 'topic_id' },
  { key: 'page_id', name: 'page_id' },
];

const SUPPORT_COPY_RECORD_LINK_TYPES = [
  ...SUPPORT_ROW_DETAILS_CONNECTION_TYPES,
  KNOWLEDGE_BASE_TYPE,
  TICKET_TYPE,
  PORTAL_ISSUE_TYPE,
];

const ResourceDetailsDialog = forwardRef(({
  projectUuid, resource, columns = initColumns, isShowIcon, highlight,
  switchResource, onToggle,
  createMoreOptions,
  getTicket,
  getKB,
  isSupportPortal: supportPortalProp = false,
  isReadonly: readonlyProp = false,
  permission: permissionProp,
  canFindRelatedIssues = true,
  canCreateRelatedTickets = true,
  canChatWithAI = true,
  canOpenIssue = true,
  getIssue = (projectUuid, issueID) => portalAPI.getPortalIssue(projectUuid, issueID),
  ...params
}, ref) => {
  const inheritedPolicy = useContext(ResourceDialogContext);
  const isSupportPortal = inheritedPolicy.isSupportPortal || supportPortalProp;
  const isReadonly = inheritedPolicy.isReadonly || readonlyProp || isSupportPortal;
  const permission = isReadonly ? PERMISSION_TYPES.READ_ONLY : permissionProp ?? inheritedPolicy.permission ?? defaultPermission;
  const [detailsState, setDetailsState] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [innerWidth, setInnerWidth] = useState(window.innerWidth);

  const { connections } = useConnections();
  const { getTableByName } = useData();

  const type = useMemo(() => resource?.type, [resource]);
  const connection = connections.find(item => String(item.id) === String(resource.connection_id));
  const tableName = type === TICKET_TYPE ? TICKET_TABLE_NAME
    : type === PORTAL_ISSUE_TYPE ? PORTAL_ISSUE_TABLE_NAME
      : type === KNOWLEDGE_BASE_TYPE ? KB_TABLE_NAME
        : getTableName(connection || { type, id: resource.connection_id });
  const resourceKey = JSON.stringify([projectUuid, type, tableName, String(resource._id)]);
  const currentKeyRef = useRef(resourceKey);
  currentKeyRef.current = resourceKey;
  const resourceDetails = detailsState?.key === resourceKey ? detailsState.value : null;

  const currentResourceDetails = useMemo(() => {
    return resourceDetails?.record || resourceDetails || null;
  }, [resourceDetails]);

  const currentColumns = useMemo(() => {
    if (resourceDetails?.columns?.length) return resourceDetails.columns;
    const cachedColumns = Object.values(getTableByName(tableName, null)?.key_column_map || {});
    return cachedColumns.length ? cachedColumns : columns;
  }, [resourceDetails, columns, getTableByName, tableName]);

  const currentResource = useMemo(() => {
    const row = { ...resource, ...currentResourceDetails };
    // Loaded fields are authoritative even when the source list uses column keys.
    currentColumns.forEach(column => {
      if (currentResourceDetails && Object.prototype.hasOwnProperty.call(currentResourceDetails, column.name)) {
        row[column.key] = currentResourceDetails[column.name];
      }
    });
    return { ...row, _id: String(row._pk ?? resource._id ?? row.id) };
  }, [resource, currentResourceDetails, currentColumns]);

  const setResourceDetails = useCallback(value => {
    if (currentKeyRef.current !== resourceKey) return;
    setDetailsState({ key: resourceKey, value });
  }, [resourceKey]);

  const handleListRowChange = useCallback(({ rowUpdate: rowUpdateData = {}, deleted, columns = [] }) => {
    const rowUpdate = {};
    columns.forEach(column => {
      if (Object.prototype.hasOwnProperty.call(rowUpdateData, column.key)) {
        rowUpdate[column.name] = rowUpdateData[column.key];
      }
    });
    eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, {
      projectUuid, tableName, rowId: currentResource._id, rowUpdate, deleted, updateList: false,
    });
  }, [projectUuid, tableName, currentResource._id]);

  const moreOptions = useMoreOptions({
    projectUuid, workspaceID, projectName, type, row: currentResource, columns: currentColumns,
    connection, connections, tableName, permission, disabled: isReadonly || !currentResourceDetails,
    canFindRelatedIssues, canCreateRelatedTickets, canChatWithAI, canOpenIssue,
    createMoreOptions, resourceDetails, onRowChange: handleListRowChange,
  });

  useResourceUpdate({ projectUuid, tableName, rowId: currentResource._id, onUpdate: ({ deleted, rowUpdate }) => {
    if (deleted) onToggle();
    else if (rowUpdate && resourceDetails) setResourceDetails({
      ...resourceDetails,
      record: { ...currentResourceDetails, ...rowUpdate },
    });
  } });

  const title = useMemo(() => {

    // connection
    if (currentResourceDetails && currentResourceDetails.title) return currentResourceDetails.title;
    const titleColumn = getColumnByName(currentColumns, 'title');
    let title = getCellValueByColumn(currentResource, titleColumn);
    if (!title && type === CONNECTION_TYPE.SEAFILE) {
      const filenameColumn = getColumnByName(currentColumns, 'filename');
      title = getCellValueByColumn(currentResource, filenameColumn);
    }
    return title;
  }, [type, currentResourceDetails, currentResource, currentColumns]);

  const url = useMemo(() => {
    return getResourceOriginalURL(type, { ...currentResource, url: currentResourceDetails?.url || currentResource?.url }, connections, currentColumns);
  }, [type, connections, currentResource, currentResourceDetails, currentColumns]);

  const internalNetworkAddress = useMemo(() => {
    return getInternalNetworkAddress(type, resource._id, { workspaceID, projectName, connectionID: resource.connection_id });
  }, [type, resource]);

  const canCopyRecordLink = SUPPORT_COPY_RECORD_LINK_TYPES.includes(type);

  const size = useMemo(() => getDialogSize(innerWidth), [innerWidth]);

  const resourceDetailsRef = useRef(null);

  const handleSwitchResource = Utils.debounce(useCallback((step) => {
    switchResource(step);
  }, [switchResource]), 300);

  const updateResourceDetails = useCallback((record) => {
    setResourceDetails(record);
  }, [setResourceDetails]);

  const handleUpdateTicket = useCallback((ticket, { columns = [] } = {}) => {
    setResourceDetails(ticket ? { record: ticket, columns } : null);
  }, [setResourceDetails]);

  const handleCopyRecordLink = useCallback(() => {
    copy(internalNetworkAddress);
    toaster.success(gettext('Link copied'));
  }, [internalNetworkAddress]);

  useEffect(() => {
    const handleResize = () => {
      setInnerWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    setActivities: (...args) => resourceDetailsRef.current?.setActivities?.(...args),
    onChange: (...args) => resourceDetailsRef.current?.onChange?.(...args),
  }), []);

  const props = {
    ref: resourceDetailsRef,
    columns,
    projectUuid,
    permission,
    highlight,
    ...params,
  };

  return (
    <ResourceDialogContext.Provider value={{ isReadonly, isSupportPortal, permission }}>
      <Modal
        className={classnames('seaqa-resource-details-dialog', size)}
        isOpen={true}
        toggle={onToggle}
      >
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
            {!isSupportPortal && internalNetworkAddress && (
              <IconButton
                className="open-in-new-tab-btn"
                icon="view-issue"
                title={gettext('Open the record in a new tab')}
                onClick={() => window.open(internalNetworkAddress, '_blank', 'noopener,noreferrer')}
              />
            )}
            {!isSupportPortal && url && (
              <IconButton
                className="open-in-new-tab-btn"
                icon="open-in-new-tab"
                title={gettext('Open the source address in a new tab')}
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              />
            )}
            {!isSupportPortal && canCopyRecordLink && internalNetworkAddress && (
              <IconButton
                className="open-in-new-tab-btn"
                icon="copy-link"
                title={gettext('Copy link')}
                onClick={handleCopyRecordLink}
              />
            )}
          </div>
          {currentResourceDetails && moreOptions.length > 0 && (
            <Dropdown className="ticket-create-more-options-dropdown" isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
              <DropdownToggle tag="span">
                <IconButton className="more-btn" icon="more" title={gettext('More')}/>
              </DropdownToggle>
              <CustomizeDropdownMenu>
                {moreOptions.map((option, index) => {
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
            <ConnectionRecordDetailsInDialog key={resourceKey} { ...props } resource={resource} onUpdateResourceDetails={updateResourceDetails} />
          )}
          {type === KNOWLEDGE_BASE_TYPE && (
            <KBInDialog key={resourceKey} knowledgeID={resource._id} updateKB={setResourceDetails} getKB={getKB} { ...props } />
          )}
          {type === TICKET_TYPE && (
            <TicketInDialog
              key={resourceKey}
              ticketID={resource._id}
              updateTicket={handleUpdateTicket}
              getTicket={getTicket}
              isReadonly={isReadonly}
              { ...props }
            />
          )}
          {type === PORTAL_ISSUE_TYPE && (
            <TicketInDialog
              key={resourceKey}
              ticketType={PORTAL_ISSUE_TYPE}
              ticketID={resource._id}
              updateTicket={handleUpdateTicket}
              getTicket={getIssue}
              isReadonly={isReadonly}
              { ...props }
            />
          )}
        </ModalBody>
      </Modal>
    </ResourceDialogContext.Provider>
  );
});

export default ResourceDetailsDialog;
