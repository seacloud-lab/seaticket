import { useCallback, useState, useMemo } from 'react';
import { Modal, ModalBody, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { CustomizeDropdownMenu, ModalHeader, IconTooltip, IconButton } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES, CONNECTION_TYPE } from '../../main-panel/connections/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { useConnections } from '../../main-panel/connections/hooks';
import ConnectionResourceDetails from '../../main-panel/connections/components/connection-resource-details';
import { getInternalNetworkAddress, getResourceIconURL, getResourceOriginalURL } from '@/project/utils';
import { KBInDialog } from '../../main-panel/knowledge-base/components';
import TicketInDialog from '../../main-panel/tickets/components/ticket-in-dialog';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';

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
  getTicket, getKB,
}) => {
  const type = useMemo(() => resource?.type, [resource]);

  const [details, setDetails] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const { connections } = useConnections();

  const title = useMemo(() => {

    // connection
    if (details && details.title) return details.title;
    const titleColumn = getColumnByName(columns, 'title');
    let title = getCellValueByColumn(resource, titleColumn);
    if (!title && type === CONNECTION_TYPE.SEAFILE) {
      const filenameColumn = getColumnByName(columns, 'filename');
      title = getCellValueByColumn(resource, filenameColumn);
    }
    return title;
  }, [resource, details, columns]);

  const url = useMemo(() => {
    return getResourceOriginalURL(type, { ...details, ...resource, url: details?.url }, connections, columns);
  }, [type, connections, resource, details, columns]);

  const internalNetworkAddress = useMemo(() => {
    return getInternalNetworkAddress(type, resource._id, { workspaceID, projectName, connectionID: resource.connection_id });
  }, [type, resource]);

  const handleSwitchResource = Utils.debounce(useCallback((step) => {
    switchResource(step);
  }, [switchResource]), 300);

  const updateDetails = useCallback((details) => {
    setDetails(details);
  }, []);

  return (
    <Modal className="sea-ticket-resource-details-dialog" isOpen={true} toggle={onToggle} style={{ minWidth: 800 }}>
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
            <div className="sea-ticket-resource-type-avatar mr-2">
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
          <ConnectionResourceDetails resource={resource} columns={columns} projectUuid={projectUuid} permission={permission} updateDetails={updateDetails} />
        )}
        {type === KNOWLEDGE_BASE_TYPE && (
          <KBInDialog projectUuid={projectUuid} knowledgeID={resource._id} updateKB={updateDetails} getKB={getKB} />
        )}
        {type === TICKET_TYPE && (
          <TicketInDialog projectUuid={projectUuid} ticketID={resource._id} updateTicket={updateDetails} getTicket={getTicket} />
        )}
      </ModalBody>
    </Modal>
  );
};

export default ResourceDetailsDialog;
