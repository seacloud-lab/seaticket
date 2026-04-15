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
import { useData, useTags } from '@/project/hooks';
import ConnectionResourceDetails, { ConnectionResourceOtherDetails } from '../../../components/connection-resource-details';
import { getResourceOriginalURL } from '@/project/utils';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { AttachmentObject } from '@/project/main-panel/ask/models';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { BAR_TYPE } from '@/project/constants';
import RelatedIssuesDialog from '../../../components/related-issues-dialog';
import CreateTicketDialog from '../../../components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE } from '../../../constants';
import { connectionsAPI } from '@/project/api';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { Utils } from '@/utils/utils';
import Rename from './rename';
import { convertRowToKeyValue } from '@/sea-metadata/utils/row';

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
  const { isLoading: isConnectionsPageLoading, pageSlugId, childrenPageSlugId } = useConnectionsPage();
  const { getRow, modifyRow, modifyRowLink, modifyLocalRow } = useData();
  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();
  const { tagsData } = useTags();

  const [containerWidth, setContainerWidth] = useState(0);
  const [record, setRecord] = useState(null);
  const [columns, setColumns] = useState(initColumns);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const recordRef = useRef(null);
  const linkedTicketTitle = useRef('');

  const connection = useMemo(() => connections.find(c => c.id === pageSlugId), [pageSlugId, connections]);
  const resource = useMemo(() => ({ type: connection?.type, connection_id: pageSlugId, _id: childrenPageSlugId }), [connection, pageSlugId, childrenPageSlugId]);
  const connectionTableName = useMemo(() => connection ? getTableName(connection) : '', [connection]);
  const cacheRecord = useMemo(() => {
    if (!connection) return '';
    const row = getRow(connectionTableName, childrenPageSlugId);
    return row;
  }, [connection, childrenPageSlugId, connectionTableName, getRow]);
  const tools = useMemo(() => {
    if (!record) return [];
    const row = { ...record, _id: childrenPageSlugId + '', _pk: childrenPageSlugId };
    const isRw = permission === PERMISSION_TYPES.READ_WRITE;
    let _tools = [
      generateAIOptions({ rows: [row], columns, connection }, (attachments) => {
        if (!Array.isArray(attachments) || attachments.length === 0) return;
        const newAttachments = attachments.map(attachment => new AttachmentObject(attachment));
        updateAttachments(newAttachments);
        toggleBar([BAR_TYPE.CHAT]);
      }),
      isRw && generateFindRelatedIssuesOption({ row, connection }, () => setIsShowRelatedIssuesDialog(true)),
      isRw && generateCreateRelatedTicketOption({ row, columns, connection }, () => setTicketDialogOpen(true)),
      isRw && generateLinkAnExistingTicketOption({ row, columns, connection }, () => setIsShowTicketsDialog(true)),
      { key: 'divider' },
      generateOpenOriginalPageOption({ row, columns, connection }),
      generateCopyOriginalLinkOption({ row, columns, connection }),
    ];
    let outdatedOptions = isRw ? generateMarkAsOutdatedOptions({ rows: [row], columns, connection }, (rowIds, idRowUpdates, idOldRowOldData) => {
      const rowId = rowIds[0];
      const rowUpdate = idRowUpdates[rowId];
      const connectionTableName = getTableName(connection);
      let localRowUpdate = {};
      if (cacheRecord) {
        const outdatedColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
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
    _tools = _tools.reduce((acc, item, index, array) => {
      if (item && item.key === 'divider' && index > 0 && array[index - 1] && array[index - 1].key === 'divider') {
        return acc;
      }
      acc.push(item);
      return acc;
    }, []);
    return _tools;
  }, [record, connection, permission, cacheRecord, columns, childrenPageSlugId, updateAttachments, toggleBar]);

  const title = useMemo(() => {
    if (record && record.title) return record.title;
    if (!cacheRecord) return '';
    return cacheRecord.title;
  }, [record, cacheRecord]);

  const url = useMemo(() => {
    if (!connection) return '';
    if (!record) return '';
    return getResourceOriginalURL(connection.type, { ...record, ...resource }, connections, initColumns);
  }, [connection, connections, resource, record]);

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

  const updateResource = useCallback(({ record, columns, linked_ticket_title }) => {
    linkedTicketTitle.current = linked_ticket_title;
    setColumns(columns);
    setRecord(record);
  }, []);

  const modifyGitHubRecord = useCallback((update, callback) => {
    const localRowUpdate = convertRowToKeyValue(update, { data: { columns } });
    connectionsAPI.modifyGithubIssue(projectUuid, pageSlugId, Number(childrenPageSlugId), update).then(res => {
      const connectionTableName = getTableName(connection);
      modifyLocalRow(connectionTableName, childrenPageSlugId, localRowUpdate);
      setRecord({ ...record, ...update });
      callback && callback(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(true);
    });
  }, [record, columns, connection, projectUuid, pageSlugId, childrenPageSlugId, modifyLocalRow]);

  const handleOthersChange = useCallback((update, callback) => {
    if (connection.type === CONNECTION_TYPE.GITHUB_ISSUE) {
      return modifyGitHubRecord(update, callback);
    }

  }, [connection, modifyGitHubRecord]);

  useEffect(() => {
    if (isConnectionsPageLoading || !record) return;
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
  }, [isConnectionsPageLoading, record]);

  if (isConnectionsPageLoading) return (<CenteredLoading />);

  // 904: details min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = record && containerWidth < 904;
  return (
    <>
      <div className={classnames('sea-connection-record-details', { 'small': isSmallScreen })} ref={recordRef}>
        <div className="sea-connection-record-details-header">
          {isRenaming ? (
            <Rename title={title} onToggle={() => setIsRenaming(false)} onSubmit={modifyGitHubRecord} />
          ) : (
            <>
              <div className="sea-connection-record-details-header-left">
                {title && (<div className="text-truncate d-inline-block" title={title}>{title}</div>)}
                {url && (
                  <IconButton
                    className="open-in-new-tab-btn"
                    icon="open-in-new-tab"
                    title={gettext('Open the original URL in a new tab')}
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  />
                )}
                {title && connection.type === CONNECTION_TYPE.GITHUB_ISSUE && permission === PERMISSION_TYPES.READ_WRITE && (
                  <IconButton
                    className="open-in-new-tab-btn"
                    icon="rename"
                    title={gettext('Edit title')}
                    onClick={() => setIsRenaming(true)}
                  />
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
            </>
          )}
        </div>
        <div className={classnames('sea-connection-record-details-body', { 'empty': !record })}>
          <div className="sea-connection-record-details-container">
            <ConnectionResourceDetails
              resource={resource}
              connection={connection}
              projectUuid={projectUuid}
              permission={permission}
              updateResource={updateResource}
            />
          </div>
          {record && (
            <div className="sea-connection-record-details-others">
              <ConnectionResourceOtherDetails
                connection={connection}
                record={record}
                columns={columns}
                permission={permission}
                projectUuid={projectUuid}
                linkedTicketTitle={linkedTicketTitle.current}
                tagsData={tagsData}
                onChange={handleOthersChange}
              />
            </div>
          )}
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
