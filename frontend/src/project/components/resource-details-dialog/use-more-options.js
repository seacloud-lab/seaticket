import { useMemo } from 'react';
import { toaster } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { useData } from '@/project/hooks/data-context';
import { useLinkTicket } from '@/project/hooks/link-ticket';
import { useRelatedIssues } from '@/project/hooks/related-issues';
import { useTicketCreation } from '@/project/hooks/ticket-creation';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { CONNECTION_TYPE, CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';
import {
  generateAIOptions, generateFindRelatedIssuesOption, generateMarkAsOutdatedOptions,
  generateOpenOriginalPageOption, generateCopyOriginalLinkOption,
} from '@/project/main-panel/connections/utils';
import { PORTAL_ISSUE_TYPE } from '@/project/main-panel/portal-issues/constants';
import { generatorIssuesContextMenuOptions } from '@/project/main-panel/portal-issues/utils';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { generatorTicketsContextMenuOptions } from '@/project/main-panel/tickets/utils';
import { getInternalNetworkAddress, normalizeContextMenuOptions } from '@/project/utils';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getColumnByName } from '@/sea-metadata/utils/column';
import eventBus from '@/utils/event-bus';
import { Utils } from '@/utils/utils';

const useMoreOptions = ({
  projectUuid, workspaceID, projectName, type, row, columns, connection, connections, tableName,
  permission, disabled, canFindRelatedIssues, canCreateRelatedTickets, canChatWithAI, canOpenIssue,
  createMoreOptions, resourceDetails, onRowChange,
}) => {
  const { modifyRow } = useData();
  const { generateConnectionLinkTicketOptions, createTicket, linkAnExistingTicket } = useLinkTicket();
  const { openRelatedIssues } = useRelatedIssues();
  const { createKnowledgeBaseRecord, createTask } = useTicketCreation();
  const { handleResolveAttachmentsByAI } = useAIChatTools();

  return useMemo(() => {
    if (disabled || !row) return [];
    if (createMoreOptions) {
      return normalizeContextMenuOptions(createMoreOptions(row, resourceDetails, { columns, onRowChange }) || []);
    }
    if (!tableName) return [];
    const rowId = String(row._id);
    const writable = permission === PERMISSION_TYPES.READ_WRITE;
    const notify = update => eventBus.dispatch(EVENT_BUS_TYPE.RESOURCE_UPDATED, { projectUuid, tableName, rowId, ...update });

    if (connection) {
      const modify = (rowIds, idRowUpdates) => Promise.all(rowIds.map(id => {
        const rowUpdateData = idRowUpdates[id];
        const rowUpdate = {};
        columns.forEach(column => {
          if (Object.prototype.hasOwnProperty.call(rowUpdateData, column.key)) {
            rowUpdate[column.name] = rowUpdateData[column.key];
          }
        });
        return modifyRow(tableName, id, rowUpdateData, () => connectionsAPI.modifyConnectionRecord(projectUuid, connection.id, id, rowUpdate))
          .then(() => notify({ rowUpdate, rowUpdateData }));
      })).catch(error => toaster.danger(Utils.getErrorMsg(error)));

      const options = [
        canChatWithAI && generateAIOptions({ rows: [row], columns, connection }, handleResolveAttachmentsByAI),
        canFindRelatedIssues && generateFindRelatedIssuesOption({ row, connection }, target => openRelatedIssues({ row: target, connection })),
        ...(canCreateRelatedTickets ? generateConnectionLinkTicketOptions({ row, columns, connection, permission }) : []),
        'Divider',
        generateOpenOriginalPageOption({ row, columns, connection }),
        generateCopyOriginalLinkOption({ row, columns, connection }),
      ];
      if (writable) {
        const markOptions = generateMarkAsOutdatedOptions({ rows: [row], columns, connection }, modify);
        if (connection.type === CONNECTION_TYPE.EMAIL) {
          const unreadColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.UNREAD);
          if (unreadColumn) {
            options.push('Divider', {
              key: 'mark_as_read', label: gettext('Mark as read'),
              callback: () => getCellValueByColumn(row, unreadColumn) && modify([rowId], { [rowId]: { [unreadColumn.key]: false } }),
            });
          }
        }
        if (markOptions.length) options.push('Divider', ...markOptions);
      }
      return normalizeContextMenuOptions(options);
    }

    const params = {
      selectedPosition: { rowIdx: 0 },
      table: { id_row_map: { [rowId]: row }, columns },
      rowGetterByIndex: () => row,
      context: { canDeleteRow: () => false },
      workspaceID, projectName,
      togglePageSlugId: () => window.open(getInternalNetworkAddress(type, rowId, { workspaceID, projectName }), '_blank', 'noopener,noreferrer'),
    };
    if (type === TICKET_TYPE) {
      const options = generatorTicketsContextMenuOptions({
        ...params,
        chatTicketsByAI: handleResolveAttachmentsByAI,
        findRelatedIssues: canFindRelatedIssues ? target => openRelatedIssues({ row: target }) : undefined,
        createKnowledgeBaseRecord: writable ? ticket => createKnowledgeBaseRecord({ ticket, columns }) : undefined,
        createTask: writable ? (ticket, connectionType) => createTask({ ticket, columns, connectionType }) : undefined,
        connections,
      });
      return normalizeContextMenuOptions(options.filter(option => canChatWithAI || option?.key !== 'chat_tickets'));
    }
    if (type === PORTAL_ISSUE_TYPE) {
      return generatorIssuesContextMenuOptions({
        ...params,
        chatIssuesByAI: canChatWithAI ? handleResolveAttachmentsByAI : undefined,
        createTicket: writable && canCreateRelatedTickets ? createTicket : undefined,
        linkAnExistingTicket: writable && canCreateRelatedTickets ? linkAnExistingTicket : undefined,
        togglePageSlugId: canOpenIssue ? params.togglePageSlugId : undefined,
      });
    }
    return [];
  }, [
    projectUuid, workspaceID, projectName, type, row, columns, connection, connections, tableName, permission, disabled,
    canFindRelatedIssues, canCreateRelatedTickets, canChatWithAI, canOpenIssue,
    createMoreOptions, resourceDetails, onRowChange,
    modifyRow, generateConnectionLinkTicketOptions, createTicket, linkAnExistingTicket,
    openRelatedIssues, createKnowledgeBaseRecord, createTask, handleResolveAttachmentsByAI,
  ]);
};

export default useMoreOptions;
