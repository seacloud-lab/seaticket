import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { Dropdown } from 'reactstrap';
import { useConnectionsPage, useConnections } from '../../../hooks';
import { CenteredLoading, IconButton, CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem, toaster } from '@/components';
import {
  getTableName, generateAIOptions, generateFindRelatedIssuesOption,
  generateCreateRelatedTicketOption, generateLinkAnExistingTicketOption,
  generateOpenOriginalPageOption, generateCopyOriginalLinkOption,
  generateMarkAsOutdatedOptions,
} from '../../../utils';
import { useData } from '@/project/hooks';
import ConnectionResourceDetails from '../../../components/connection-resource-details';
import { getResourceOriginalURL } from '@/project/utils';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { BAR_TYPE } from '@/project/constants';
import RelatedIssuesDialog from '../../../components/related-issues-dialog';
import CreateTicketDialog from '../../../components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '../../../constants';
import { connectionsAPI } from '@/project/api';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { Utils } from '@/utils/utils';

import './index.css';

const initColumns = [
  { key: 'filename', name: 'filename' },
  { key: 'path', name: 'path' },
  { key: 'title', name: 'title' },
  { key: 'url', name: 'url' },
  { key: 'slug', name: 'slug' },
  { key: 'topic_id', name: 'topic_id' },
  { key: CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET, name: CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET },
  { key: CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED, name: CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED },
];

const Record = ({ projectUuid, permission, toggleBar }) => {
  const { isLoading: isConnectionsPageLoading, pageSlugId, childrenPageSlugId, updateConnectionInfo } = useConnectionsPage();
  const { getRow, getTableByName, modifyRow, modifyRowLink } = useData();
  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();

  const [containerWidth, setContainerWidth] = useState(0);
  const [details, setDetails] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);

  const recordRef = useRef(null);

  const connection = useMemo(() => connections.find(c => c.id === pageSlugId), [pageSlugId, connections]);
  const resource = useMemo(() => ({ type: connection?.type, connection_id: pageSlugId, _id: childrenPageSlugId }), [connection, pageSlugId, childrenPageSlugId]);
  const connectionTableName = useMemo(() => connection ? getTableName(connection) : '', [connection]);
  const cacheRecord = useMemo(() => {
    if (!connection) return '';
    const row = getRow(connectionTableName, childrenPageSlugId);
    return row;
  }, [connection, childrenPageSlugId, connectionTableName, getRow]);
  const cacheColumns = useMemo(() => {
    const table = getTableByName(connectionTableName);
    return Object.values(table.key_column_map);
  }, [connectionTableName, getTableByName]);
  const columns = useMemo(() => cacheRecord ? cacheColumns : initColumns, [cacheRecord, cacheColumns]);
  const tools = useMemo(() => {
    if (!details) return [];
    const isRw = permission === PERMISSION_TYPES.READ_WRITE;
    let _tools = [
      generateAIOptions({ rows: [details], columns: initColumns, connection }, (attachments) => {
        if (!Array.isArray(attachments) || attachments.length === 0) return;
        const newAttachments = attachments.map(attachment => new AttachmentObject(attachment));
        updateAttachments(newAttachments);
        toggleBar([BAR_TYPE.CHAT]);
      }),
      isRw && generateFindRelatedIssuesOption({ row: details, connection }, () => setIsShowRelatedIssuesDialog(true)),
      isRw && generateCreateRelatedTicketOption({ row: details, columns: initColumns, connection }, () => setTicketDialogOpen(true)),
      isRw && generateLinkAnExistingTicketOption({ row: details, columns: initColumns, connection }, () => setIsShowTicketsDialog(true)),
      { key: 'divider' },
      generateOpenOriginalPageOption({ row: details, columns: initColumns, connection }),
      generateCopyOriginalLinkOption({ row: details, columns: initColumns, connection }),
    ];
    let outdatedOptions = isRw ? generateMarkAsOutdatedOptions({ rows: [{ ...details, _id: childrenPageSlugId }], columns: initColumns, connection }, (rowIds, idRowUpdates, idOldRowOldData) => {
      const rowId = rowIds[0];
      const rowUpdate = idRowUpdates[rowId];
      const connectionTableName = getTableName(connection);
      let localRowUpdate = {};
      if (cacheRecord) {
        const outdatedColumn = getColumnByName(cacheColumns, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
        if (outdatedColumn) {
          localRowUpdate[outdatedColumn.key] = rowUpdate[CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED];
        }
      }
      modifyRow(connectionTableName, rowId, localRowUpdate, () => connectionsAPI.modifyConnectionRecord(projectUuid, connection?.id, rowId, rowUpdate));
    }) : [];
    if (outdatedOptions.length > 0) {
      _tools.push({ key: 'divider' });
      _tools.push(...outdatedOptions);
    }
    _tools = _tools.filter(Boolean);
    if (_tools[0]?.key === 'divider') {
      _tools.shift();
    }
    if (_tools[_tools.length - 1]?.key === 'divider') {
      _tools.pop();
    }
    return _tools;
  }, [details, connection, permission, cacheRecord, cacheColumns, updateAttachments, toggleBar]);

  const title = useMemo(() => {
    if (details && details.title) return details.title;
    if (!cacheRecord) return '';
    return cacheRecord.title;
  }, [details, cacheRecord]);

  const url = useMemo(() => {
    if (!connection) return '';
    if (!details) return '';
    return getResourceOriginalURL(connection.type, { ...details, ...resource }, connections, initColumns);
  }, [connection, connections, resource, details]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const linkedTicketColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const rowId = childrenPageSlugId;
    const connectionLinkedUpdate = {
      [ticket.id]: ticket.title,
    };
    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`${connection?.id}_${rowId}`] },
      linked_records: { [`${connection?.id}_${rowId}`]: title }
    }, {
      tableName: connectionTableName,
      rowId: rowId,
      rowUpdate: rowUpdate,
      linked_records: connectionLinkedUpdate
    }, () => {
      return connectionsAPI.modifyConnectionRecord(projectUuid, connection?.id, rowId, { [linkedTicketColumn.name]: ticket.id }).then(res => {
        callback && callback();
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
      });
    });
  }, [title, columns, childrenPageSlugId, connection, modifyRowLink]);

  const updateDetails = useCallback((details) => {
    setDetails(details?.title ? details : '');
  }, [updateConnectionInfo]);

  useEffect(() => {
    if (isConnectionsPageLoading || !details) return;
    const recordDom = recordRef.current;
    const handleResize = () => {
      if (!recordDom) return;
      setContainerWidth(recordDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    recordDom && resizeObserver.observe(recordDom);

    return () => {
      recordDom && resizeObserver.unobserve(recordDom);
    };
  }, [isConnectionsPageLoading, details]);

  if (isConnectionsPageLoading) return (<CenteredLoading />);

  // 904: details min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = details && containerWidth < 904;
  return (
    <>
      <div className={classnames('sea-connection-record-details', { 'small': isSmallScreen })} ref={recordRef}>
        <div className="sea-connection-record-details-header">
          <div className="sea-connection-record-details-header-left">
            {title && (
              <>
                {title && (<div className="text-truncate d-inline-block" title={title}>{title}</div>)}
                {url && (
                  <IconButton
                    className="open-in-new-tab-btn"
                    icon="open-in-new-tab"
                    title={gettext('Open the original URL in a new tab')}
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  />
                )}
              </>
            )}
          </div>
          <div className="sea-connection-record-details-header-right">
            {tools.length > 0 && (
              <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
                <CustomizeDropdownMoreToggle isOpen={isMoreMenuOpen} title={gettext('More')} />
                <CustomizeDropdownMenu className="position-fixed">
                  {tools.map((tool, index) => {
                    if (tool.key === 'divider' || tool === 'Divider') {
                      return <CustomizeDropdownItem key={index} divider />;
                    }
                    return (
                      <CustomizeDropdownItem
                        key={tool.key}
                        onClick={() => {
                          tool.callback && tool.callback();
                          setIsMoreMenuOpen(false);
                        }}
                      >
                        {tool.label}
                      </CustomizeDropdownItem>
                    );
                  })}
                </CustomizeDropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>
        <div className={classnames('sea-connection-record-details-body', { 'empty': !details })}>
          <div className="sea-connection-record-details-container">
            <ConnectionResourceDetails resource={resource} connection={connection} projectUuid={projectUuid} permission={permission} updateDetails={updateDetails} />
          </div>
          {details && (<div className="sea-connection-record-details-others"></div>)}
        </div>
      </div>
      {isShowRelatedIssuesDialog && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          row={{ _id: childrenPageSlugId }}
          connectionId={connection?.id}
          onClose={() => setIsShowRelatedIssuesDialog(false)}
        />
      )}
      {isTicketDialogOpen && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={{ _id: childrenPageSlugId }}
          connection={connection}
          columns={columns}
          onClose={() => setTicketDialogOpen(false)}
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

export default Record;
