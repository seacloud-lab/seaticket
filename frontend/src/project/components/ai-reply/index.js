import React, { useCallback, useState, useImperativeHandle, forwardRef, useMemo, useRef } from 'react';
import classnames from 'classnames';
import { connectionsAPI } from '@/project/api';
import context from '@/sea-metadata/context';
import { AttachmentObject } from '@/project/main-panel/ask/models';

// components
import { ELementTypes } from '@seafile/seafile-editor';
import { CustomizeMarkdownViewer as CustomizeMarkdownViewerComponent, LinkVerifiedDialog, toaster } from '@/components';
import CustomizeDefinition from './customize-definition';
import CustomizeLinkReference from './customize-link-reference';
import CustomizeLink from './customize-link';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import RelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';

// hooks
import { useConnections } from '@/project/main-panel/connections/hooks';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { useData, useMetadata } from '@/project/hooks';

// utils
import { formatSources, transformMDFileToLink, transformKBToLink, transformReferencesToMarkdown, transformContentForCopy, } from './utils';
import {
  generateAIOptions, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption,
  generateLinkAnExistingTicketOption, generateOpenOriginalPageOption,
  generateCopyOriginalLinkOption, generateMarkAsOutdatedOptions, getTableName,
} from '@/project/main-panel/connections/utils';
import { normalizeContextMenuOptions } from '@/project/utils';
import { Utils } from '@/utils/utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { hasOwnProperty } from '@/utils/object-utils';

// constants
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';

import './index.css';

const AIReply = forwardRef(({
  messageId,
  message,
  projectUuid,
  projectName,
  workspaceID,
  className: propsClassName,
  canPreviewLinkedFile = true,
  openDocument,
}, ref) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [className, setClassName] = useState('');
  const [isShowResourceDetails, setIsShowResourceDetails] = useState(false);
  const [resource, setResource] = useState(null);
  const [isShowLinkVerifiedDialog, setIsShowLinkVerifiedDialog] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const actionContextRef = useRef(null);

  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();
  const { modifyRow, modifyRowLink, insertRowByLink } = useData();

  const { aiReply, aiReplyForCopy, sources, mdFiles } = useMemo(() => {
    if (Object.keys(message).length === 0 || !hasOwnProperty(message, 'ai_reply')) {
      return { aiReply: '', aiReplyForCopy: '', sources: [], mdFiles: [] };
    }

    let value = message.ai_reply || '';
    let aiReplyForCopy = '';

    let sources = formatSources(message.sources, { workspaceID, projectName });
    let mdFiles = [];
    value = transformMDFileToLink(value, mdFiles, messageId);
    value = transformKBToLink(value, { workspaceID, projectName });

    if (value && messageId === 'typing') {
      const referenceXRegex = /<reference_(\d+)>/g;
      value = value.replace(referenceXRegex, '');
    }
    value = transformReferencesToMarkdown(value, sources);
    aiReplyForCopy = transformContentForCopy(value, { mdFiles, sources });
    if (sources.length > 0) {
      const sourcesString = sources.map((s, i) => `[${i + 1}]: ${s.url} "${s.title}"`).join('\n');
      value = value + `\n\n${sourcesString}`;
    }

    return {
      aiReply: value,
      aiReplyForCopy,
      sources,
      mdFiles,
    };
  }, [message, projectName, workspaceID, messageId]);

  const handleConnectionRecord = useCallback((record) => {
    setResource(record);
    setIsShowResourceDetails(true);
  }, []);

  const openConnectionRecord = useCallback((event, record) => {
    handleConnectionRecord(record);
  }, [handleConnectionRecord]);

  const closeConnectionRecord = useCallback(() => {
    setResource(null);
    setIsShowResourceDetails(false);
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
    const newAttachments = attachments.map(attachment => new AttachmentObject(attachment));
    updateAttachments(newAttachments);
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
  }, [modifyRow, projectUuid]);

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

    const markAsOutdatedOptions = generateMarkAsOutdatedOptions({ rows: [row], columns, connection }, modifyRowsByDetailsMenu);
    if (markAsOutdatedOptions.length > 0) {
      options.push('Divider');
      options.push(...markAsOutdatedOptions);
    }

    return normalizeContextMenuOptions(options);
  }, [connections, handleResolveIssueByAI, openRelatedIssuesDialog, openCreateTicketDialog, openTicketsDialog, modifyRowsByDetailsMenu]);

  const createTicketCallback = useCallback((ticket) => {
    const actionContext = actionContextRef.current;
    if (!actionContext?.connection || !actionContext?.columns || !actionContext?.row) return;

    const { row, details, updateResourceDetails, columns, connection } = actionContext;
    const linkColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    if (!linkColumn) return;

    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, getTableName(connection), linkedUpdateRecord, row._id, rowUpdateData, () => {
      const eventBus = context.eventBus;
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, row._id, rowUpdateData);
      eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
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
        const eventBus = context.eventBus;
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: connectionLinkedUpdate }, false);
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
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
      });
    });
  }, [modifyRowLink, projectUuid]);

  const options = useMemo(() => {
    return {
      'loading': {
        render: (() => null)()
      },
      [ELementTypes.DEFINITION]: {
        render: (<CustomizeDefinition sources={sources} openDefinitionRecord={openConnectionRecord} />)
      },
      [ELementTypes.LINK_REFERENCE]: {
        render: (<CustomizeLinkReference />)
      },
      [ELementTypes.LINK]: {
        render: (<CustomizeLink canPreviewLinkedFile={canPreviewLinkedFile} openDocument={openDocument} mdFiles={mdFiles} />)
      }
    };
  }, [sources, mdFiles, canPreviewLinkedFile, openConnectionRecord, openDocument]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    const valueCount = value.length;
    if (valueCount === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    } else {
      setAIMessageType('rich-text');
    }
    const lastDom = value[valueCount - 1];
    if (lastDom.type === 'paragraph' && lastDom.children.length > 2) {
      const last2Child = lastDom.children[lastDom.children.length - 2];
      if (last2Child.type === 'link' && last2Child.url.startsWith('file:///sea-ticket/')) {
        setClassName('ends-with-link');
      }
    }
  }, []);

  const switchResource = useCallback((step) => {
    const index = sources.findIndex(r => r.key === resource.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > sources.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = sources.length - 1;
    }
    const currentRow = sources[newIndex];
    handleConnectionRecord(currentRow);
  }, [sources, resource, handleConnectionRecord]);

  useImperativeHandle(ref, () => ({
    getAIReply: () => aiReplyForCopy,
  }), [aiReplyForCopy]);

  return (
    <>
      {aiReply && (
        <div className={classnames('seaqa-ai-reply', aiMessageType, className, propsClassName)}>
          <CustomizeMarkdownViewerComponent
            value={aiReply}
            showTOC={false}
            isShowLoading={messageId?.startsWith('typing') && messageId === 'typing' ? false : true}
            options={options}
            beforeRenderCallback={beforeAIReplyRenderCallback}
            onDefinitionClick={openConnectionRecord}
          />
        </div>
      )}
      {isShowResourceDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          isShowIcon={true}
          switchResource={sources.length > 1 ? switchResource : null}
          createMoreOptions={createMoreOptions}
          onToggle={closeConnectionRecord}
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
      {isShowLinkVerifiedDialog && (
        <LinkVerifiedDialog link={resource.url} onToggle={() => setIsShowLinkVerifiedDialog(false)} />
      )}
    </>
  );

});

export default AIReply;
