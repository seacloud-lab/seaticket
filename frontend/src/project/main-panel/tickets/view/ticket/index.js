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
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { getTableName } from '@/project/main-panel/connections/utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { ticketsAPI } from '../../../../api';
import { KeyboardShortcuts } from '../../components';
import CreateKBRecordDialog from '../../components/create-kb-record-dialog';
import CreateTaskDialog from '../../components/create-task-dialog';
import RelatedIssuesDialog from '../../components/related-issues-dialog';
import TicketDetails from '../../components/ticket-details';
import {
  TICKET_STATE_CONFIG, PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME, TICKET_CHILDREN_PAGE_SLUG_ID,
  TICKET_TYPE,
} from '../../constants';
import { Ticket as TicketModel } from '../../models';
import {
  convertTicketToKb, generatorTicketsContextMenuOptions,
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
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isShowCreateKBRecordDialog, setIsShowCreateKBRecordDialog] = useState(false);
  const [isShowCreateTaskDialog, setIsShowCreateTaskDialog] = useState(false);
  const [createTaskConnectionType, setCreateTaskConnectionType] = useState(CONNECTION_TYPE.GENERAL_TASK);

  const { typesData } = useMetadata();
  const { connections } = useConnections();
  const { modifyLocalRow, getTableByName, deleteRow, insertRowByLink } = useData();
  const { tagsData } = useTags();
  const { handleResolveAttachmentsByAI } = useAIChatTools();
  const { loading: isLoadingNotifications, markProjectNoticeAsReadByTicket } = useNotification();

  const lastTicketID = useRef('');

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

  const findRelatedIssues = useCallback(() => {
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const createKnowledgeBaseRecord = useCallback(() => {
    setIsShowCreateKBRecordDialog(true);
  }, []);

  const createTask = useCallback((_, connectionType = CONNECTION_TYPE.GENERAL_TASK) => {
    setCreateTaskConnectionType(connectionType);
    setIsShowCreateTaskDialog(true);
  }, []);

  const handleTaskCreated = useCallback(({ task, connection, activities = [], ticket: ticketUpdate = null }) => {
    if (!ticket) return;

    const newValueKey = `${connection.id}_${task._pk}`;
    const oldValue = ticket.linked_connection_records || [];
    const newValue = Array.isArray(oldValue) ? Array.from(new Set([...oldValue, newValueKey])) : [newValueKey];

    // update cache
    const table = getTableByName(TICKET_TABLE_NAME, null);
    if (table) {
      const columns = Object.values(table.key_column_map);
      const linkedConnectionRecordsColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.LINKED_CONNECTION_RECORDS);
      const update = { [linkedConnectionRecordsColumn.key]: newValue };
      if (ticketUpdate) {
        const stateColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.STATE);
        const substateColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE);
        const modifiedTimeColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.MODIFIED_TIME);
        const closedTimeColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.CLOSED_TIME);
        if (ticketUpdate.state !== undefined && stateColumn) update[stateColumn.key] = ticketUpdate.state;
        if (ticketUpdate.substate !== undefined && substateColumn) update[substateColumn.key] = ticketUpdate.substate;
        if (ticketUpdate.modified_time !== undefined && modifiedTimeColumn) update[modifiedTimeColumn.key] = ticketUpdate.modified_time;
        if (ticketUpdate.closed_time !== undefined && closedTimeColumn) update[closedTimeColumn.key] = ticketUpdate.closed_time;
      }
      const connectionTableName = getTableName(connection);
      const linked_records = { [newValueKey]: task.title };
      insertRowByLink(connectionTableName, TICKET_TABLE_NAME, linked_records, ticketID, update, () => {
        // nothing todo
      });
    }

    const update = { linked_connection_records: newValue };
    if (ticketUpdate) {
      if (ticketUpdate.state !== undefined) update.state = ticketUpdate.state;
      if (ticketUpdate.substate !== undefined) update.substate = ticketUpdate.substate;
      if (ticketUpdate.closed_time !== undefined) update.closed_time = ticketUpdate.closed_time;
    }
    const newTicket = ticket._update(update);

    setTicket(deepCopy(newTicket));
    setLinkedRecords((prev) => ({ ...prev, [newValueKey]: { _pk: task._pk, title: task.title, connection_type: connection.type } }));

    if (Array.isArray(activities) && activities.length > 0 && isFunction(detailsRef?.current?.setActivities)) {
      detailsRef.current.setActivities(`${TICKET_TYPE}_${ticketID}`, prevActivities => [...prevActivities, ...activities]);
    }
    return;
  }, [ticket, ticketID, getTableByName, insertRowByLink]);

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

  useEffect(() => {
    if (lastTicketID.current === ticketID) return;
    lastTicketID.current = ticketID;
    setLoading(true);
    setTicket(null);
    setLoadError('');

    // Load ticket data
    ticketsAPI.getProjectTicket(projectUuid, ticketID).then(res => {
      handleUpdateRowsCacheData(ticketID, res.data.ticket);
      const ticket = new TicketModel(res.data.ticket);
      setLoadError(res.data?.error_msg || '');
      setTicket(ticket);
      setLinkedRecords(res.data?.linked_records_info || {});
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, ticketID, handleUpdateRowsCacheData, markProjectNoticeAsReadByTicket]);

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
      {isShowRelatedIssuesDialog && (
        <RelatedIssuesDialog
          projectUuid={projectUuid}
          ticketId={ticket._id || ticket.id}
          workspaceID={workspaceID}
          projectName={projectName}
          onClose={() => setIsShowRelatedIssuesDialog(false)}
        />
      )}
      {isShowCreateKBRecordDialog && (
        <CreateKBRecordDialog
          projectUuid={projectUuid}
          ticket={convertTicketToKb(ticket)}
          onClose={() => setIsShowCreateKBRecordDialog(false)}
        />
      )}
      {isShowCreateTaskDialog && (
        <CreateTaskDialog
          projectUuid={projectUuid}
          workspaceID={workspaceID}
          projectName={projectName}
          ticket={ticket}
          connectionType={createTaskConnectionType}
          onClose={() => setIsShowCreateTaskDialog(false)}
          onSubmitCallback={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default Ticket;
