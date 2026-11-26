import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { CenteredLoading, toaster, EmptyTip } from '@/components';
import { useNotification } from '@/components/common/notification/hooks/notification';
import {
  gettext, name, username, avatarURL, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { useData, useTags, useMetadata } from '@/project/hooks';
import { useRelatedIssues } from '@/project/hooks/related-issues';
import { useResourceUpdate } from '@/project/hooks/resource-dialog';
import { useTicketCreation } from '@/project/hooks/ticket-creation';
import { useTicketTaskCreated } from '@/project/hooks/ticket-task-created';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { ticketsAPI } from '../../../../api';
import { KeyboardShortcuts } from '../../components';
import TicketDetails from '../../components/ticket-details';
import {
  TICKET_STATE_CONFIG, PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME, TICKET_CHILDREN_PAGE_SLUG_ID,
  TICKET_TYPE,
} from '../../constants';
import { Ticket as TicketModel } from '../../models';
import {
  generatorTicketsContextMenuOptions,
} from '../../utils';
import Header from './header';

import './index.css';

const Ticket = ({
  projectUuid, ticketID, permission, isAdmin = false, projectName, workspaceID,
  togglePageSlugId,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [ticket, setTicket] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState({});

  const { typesData } = useMetadata();
  const { connections } = useConnections();
  const { modifyLocalRow, getTableByName, deleteRow } = useData();
  const { tagsData } = useTags();
  const { handleResolveAttachmentsByAI } = useAIChatTools();
  const { openRelatedIssues } = useRelatedIssues();
  const { createKnowledgeBaseRecord: openCreateKB, createTask: openCreateTask } = useTicketCreation();
  const { loading: isLoadingNotifications, markProjectNoticeAsReadByTicket } = useNotification();

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const ticketRef = useRef(null);
  const headerRef = useRef(null);
  const detailsRef = useRef(null);
  const pendingTaskUpdatesRef = useRef([]);

  const handleScroll = useCallback((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const height = dom.offsetHeight;
    setIsShowStickyHeader(event.target.scrollTop >= height);
  }, [headerRef]);

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    const table = getTableByName(TICKET_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(TICKET_TABLE_NAME, ticketID, convertRowToKeyValue(update, { data: { columns }, typesData, tagsData }));
  }, [typesData, tagsData, getTableByName, modifyLocalRow]);

  // api
  const modifyTicket = useCallback((projectUuid, ticketID, data) => {
    return ticketsAPI.modifyProjectTicket(projectUuid, ticketID, data);
  }, []);

  const createComment = useCallback((projectUuid, ticketID, comment) => {
    return ticketsAPI.createProjectTicketComment(projectUuid, ticketID, comment);
  }, []);

  const modifyComment = useCallback((projectUuid, ticketID, commentID, comment) => {
    return ticketsAPI.modifyProjectTicketComment(projectUuid, ticketID, commentID, comment);
  }, []);

  const deleteComment = useCallback((projectUuid, ticketID, commentID) => {
    return ticketsAPI.deleteProjectTicketComment(projectUuid, ticketID, commentID);
  }, []);

  useResourceUpdate({ projectUuid, tableName: TICKET_TABLE_NAME, rowId: ticketID, onUpdate: ({ deleted }) => {
    if (deleted) togglePageSlugId(TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
  } });

  const findRelatedIssues = useCallback(() => {
    openRelatedIssues({ row: ticket });
  }, [openRelatedIssues, ticket]);

  const createKnowledgeBaseRecord = useCallback(() => {
    openCreateKB({ ticket });
  }, [openCreateKB, ticket]);

  const createTask = useCallback((_, connectionType) => {
    openCreateTask({ ticket, connectionType });
  }, [openCreateTask, ticket]);

  useTicketTaskCreated({ projectUuid, rowId: ticketID, onUpdate: ({ updateTicket, linkedRecords }) => {
    if (isLoading) pendingTaskUpdatesRef.current.push(updateTicket);
    setTicket(current => {
      const update = updateTicket(current);
      return current?._update ? deepCopy(current._update(update)) : { ...current, ...update };
    });
    setLinkedRecords(previous => ({ ...previous, ...linkedRecords }));
  } });

  const createMoreOptions = useCallback(() => {
    if (!ticket) return [];
    const table = getTableByName(TICKET_TABLE_NAME, {
      id_row_map: {},
      key_column_map: {
        [PREDEFINED_TICKET_COLUMN_NAME.TITLE]: { name: PREDEFINED_TICKET_COLUMN_NAME.TITLE }
      },
    });
    const row = { ...ticket, _id: ticket._pk };
    let options = generatorTicketsContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row.id]: row }, columns: Object.values(table.key_column_map) },
      rowMetrics: { idSelectedRowMap: {} },
      canDeleteRow: true,
      deleteRow: (_) => {
        deleteRow(TICKET_TABLE_NAME, row.id, () => ticketsAPI.deleteProjectTicket(projectUuid, row.id))
          .then(() => {
            toaster.success(gettext('Ticket deleted'));
            togglePageSlugId(TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
          })
          .catch((error) => {
            toaster.danger(Utils.getErrorMsg(error));
          });
      },
      rowGetterByIndex: () => row,
      chatTicketsByAI: handleResolveAttachmentsByAI,
      togglePageSlugId: () => {},
      workspaceID,
      projectName,
      findRelatedIssues,
      createKnowledgeBaseRecord,
      connections,
      createTask,
    }).filter(item => item.key !== 'open_ticket');
    if (options[options.length - 1] !== 'Divider') {
      options.push('Divider');
    }
    options.push({
      label: gettext('Open keyboard shortcuts'),
      key: 'open_keyboard_shortcuts',
      callback: () => setIsShowKeyboardShortcuts(true),
    });
    return options;
  }, [
    ticket, projectUuid, workspaceID, projectName, connections,
    getTableByName, deleteRow, handleResolveAttachmentsByAI, findRelatedIssues, createKnowledgeBaseRecord, createTask,
    togglePageSlugId,
  ]);

  const onTitleChange = useCallback((title, callback) => {
    if (!isFunction(detailsRef?.current?.onChange)) return null;
    detailsRef.current.onChange(ticket.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket]);

  const updateRowsCacheRef = useRef(handleUpdateRowsCacheData);
  updateRowsCacheRef.current = handleUpdateRowsCacheData;
  useEffect(() => {
    let isCurrentRequest = true;
    setLoading(true);
    setTicket(null);
    setLinkedRecords({});
    setLoadError('');
    pendingTaskUpdatesRef.current = [];

    ticketsAPI.getProjectTicket(projectUuid, ticketID).then(res => {
      if (!isCurrentRequest) return;
      // Preserve task results received while the detail request was in flight.
      const ticketData = pendingTaskUpdatesRef.current.reduce((current, updateTicket) => ({
        ...current, ...updateTicket(current),
      }), res.data.ticket);
      pendingTaskUpdatesRef.current = [];
      updateRowsCacheRef.current(ticketID, ticketData);
      const loadedTicket = new TicketModel(ticketData);
      setLoadError(res.data?.error_msg || '');
      setTicket(current => {
        if (!current) return loadedTicket;
        return deepCopy(loadedTicket._update({
          ...current,
          linked_connection_records: Array.from(new Set([
            ...loadedTicket.linked_connection_records, ...(current.linked_connection_records || []),
          ])),
        }));
      });
      setLinkedRecords(current => ({ ...(res.data?.linked_records_info || {}), ...current }));
      setLoading(false);
    }).catch(error => {
      if (!isCurrentRequest) return;
      toaster.danger(Utils.getErrorMsg(error));
      setLoading(false);
    });
    return () => { isCurrentRequest = false; };
  }, [projectUuid, ticketID]);

  useEffect(() => {
    if (isLoading || isLoadingNotifications || !ticket) return;
    markProjectNoticeAsReadByTicket(projectUuid, Number(ticketID));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, isLoading, isLoadingNotifications, ticketID]);

  if (isLoading) return (<CenteredLoading />);
  if (!ticket) {
    const emptyText = loadError || gettext('Not found ticket');
    return (
      <EmptyTip
        src={`${mediaUrl}img/no-items-tip.png`}
        text={emptyText}
      />
    );
  }

  const { id, state, title, creator, type } = ticket;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const stateOption = TICKET_STATE_CONFIG[state];

  return (
    <div
      className="seaqa-project-ticket"
      onScroll={handleScroll}
      ref={ticketRef}
    >
      <Header
        ref={headerRef}
        readonly={!editable}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
        createMoreOptions={createMoreOptions}
        modifyTitle={onTitleChange}
      />
      <Header
        className={classnames('seaqa-project-ticket-simple-info-wrapper-sticky', { 'd-none': !isShowStickyHeader })}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
      />
      <TicketDetails
        ref={detailsRef}
        ticketType={TICKET_TYPE}
        smallScreenSize={904} // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
        permission={permission}
        isAdmin={isAdmin}
        projectUuid={projectUuid}
        ticket={ticket}
        setTicket={setTicket}
        modifyTicket={editable ? modifyTicket : undefined}
        linkedRecords={linkedRecords}
        setLinkedRecords={setLinkedRecords}
        createComment={createComment}
        modifyComment={modifyComment}
        deleteComment={deleteComment}
      />
      {isShowKeyboardShortcuts && (
        <KeyboardShortcuts toggle={() => setIsShowKeyboardShortcuts(false)} />
      )}
    </div>
  );
};

export default Ticket;
