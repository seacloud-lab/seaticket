import { useCallback, useState, useMemo } from 'react';
import { Modal, ModalBody, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { CustomizeDropdownMenu, ModalHeader, IconTooltip, IconButton } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { Utils } from '@/utils/utils';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES, CONNECTION_TYPE } from '../../main-panel/connections/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { useConnections } from '../../main-panel/connections/hooks';
import ConnectionDetails from './connection-details';
import { getInternalNetworkAddress, getResourceIconURL, getResourceOriginalURL } from '@/project/utils';
import { KBInDialog } from '../../main-panel/knowledge-base/components';
import TicketInDialog from '../../main-panel/tickets/components/ticket-in-dialog';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { PORTAL_ISSUE_TYPE } from '@/project/main-panel/portal-issues/constants';
import { portalAPI } from '@/portal/api';

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
  projectUuid, resource, columns = initColumns, isShowIcon,
  switchResource, onToggle,
  createMoreOptions,
  getTicket,
  getKB,
  getIssue = (projectUuid, issueID) => portalAPI.getPortalIssue(projectUuid, issueID),
}) => {
  const type = useMemo(() => resource?.type, [resource]);

  const [resourceDetails, setResourceDetails] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const { connections } = useConnections();

  const currentResourceDetails = useMemo(() => {
    return resourceDetails?.record || resourceDetails || null;
  }, [resourceDetails]);

  const currentResource = useMemo(() => {
    return currentResourceDetails ? { ...resource, ...currentResourceDetails } : resource;
  }, [resource, currentResourceDetails]);

  const currentColumns = useMemo(() => {
    return resourceDetails?.columns || columns;
  }, [resourceDetails, columns]);

  const moreOptions = useMemo(() => {
    if (!createMoreOptions) return [];
    return createMoreOptions(currentResource, resourceDetails, {
      columns: currentColumns,
      updateResourceDetails: setResourceDetails,
    }) || [];
  }, [createMoreOptions, currentResource, resourceDetails, currentColumns]);

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
  }, [resource, type, resourceDetails, columns]);

  const url = useMemo(() => {
    return getResourceOriginalURL(type, { ...currentResource, url: currentResourceDetails?.url || currentResource?.url }, connections, currentColumns);
  }, [type, connections, currentResource, currentResourceDetails, currentColumns]);

  const internalNetworkAddress = useMemo(() => {
    return getInternalNetworkAddress(type, resource._id, { workspaceID, projectName, connectionID: resource.connection_id });
  }, [type, resource]);

  const handleSwitchResource = Utils.debounce(useCallback((step) => {
    switchResource(step);
  }, [switchResource]), 300);

  const updateResourceDetails = useCallback((record) => {
    setResourceDetails(record);
  }, []);

  const handleUpdateTicket = useCallback((ticket) => {
    setResourceDetails(ticket);
  }, []);

  const handleUpdateIssue = useCallback((issue) => {
    setResourceDetails(issue);
  }, []);

  const props = {
    columns,
    projectUuid,
    permission,
  };

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
        {moreOptions.length > 0 && (
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
          <ConnectionDetails
            projectUuid={projectUuid}
            resource={resource}
            columns={columns}
            permission={PERMISSION_TYPES.READ_WRITE}
            onUpdateResourceDetails={updateResourceDetails}
          />
        )}
        {type === KNOWLEDGE_BASE_TYPE && (
          <KBInDialog knowledgeID={resource._id} updateKB={(kb) => setResourceDetails(kb)} getKB={getKB} { ...props } />
        )}
        {type === TICKET_TYPE && (
          <TicketInDialog ticketID={resource._id} updateTicket={handleUpdateTicket} getTicket={getTicket} { ...props } />
        )}
        {type === PORTAL_ISSUE_TYPE && (
          <TicketInDialog ticketType={PORTAL_ISSUE_TYPE} ticketID={resource._id} updateTicket={handleUpdateIssue} getTicket={getIssue} { ...props } />
        )}
      </ModalBody>
    </Modal>
  );
};

export default ResourceDetailsDialog;
