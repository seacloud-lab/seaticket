import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster, EmptyTip, IconTooltip } from '@/components';
import {
  TICKET_STATE_CONFIG, PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME, TICKET_CHILDREN_PAGE_SLUG_ID,
  AUTO_UPDATE_PARTICIPANTS_KEY,
} from '../../constants';
import { BAR_TYPE } from '@/project/constants';
import { convertTicketToKb, generatorTicketsContextMenuOptions } from '../../utils';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES
} from '@/constants';
import { Utils } from '@/utils/utils';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings, LinkSettings,
} from '../../components/ticket-settings';
import { Comment, TicketLog, KeyboardShortcuts, UploadFilesButton } from '../../components';
import StatusToggleButton from './status-toggle-btn';
import RelatedIssuesDialog from '../../components/related-issues-dialog';
import CreateKBRecordDialog from '../../components/create-kb-record-dialog';
import CreateTaskDialog from '../../components/create-task-dialog';
import { ticketsAPI } from '../../../../api';
import { Ticket as TicketModel } from '../../models';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import Header from './header';
import { useData, useTags, useMetadata } from '@/project/hooks';
import { useConnections } from '@/project/main-panel/connections/hooks';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useNotification } from '@/components/common/notification/hooks/notification';
import { hasOwnProperty } from '@/utils/object-utils';
import { useCollaborators } from '@/sea-metadata';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getTableName, getConnectionIcon } from '@/project/main-panel/connections/utils';

import './index.css';

const GITHUB_ISSUE_CONNECTION_TYPE = 'github_issue';

const parseLinkedRecordKey = (key) => {
  const [connectionID, recordPK] = String(key || '').split('_');
  if (!connectionID || !recordPK || connectionID === 'portal') return null;

  const parsedConnectionID = Number(connectionID);
  const parsedRecordPK = Number(recordPK);
  if (Number.isNaN(parsedConnectionID) || Number.isNaN(parsedRecordPK)) return null;

  return {
    connection_id: parsedConnectionID,
    record_pk: parsedRecordPK,
  };
};

const isGithubIssueClosed = (issueState) => {
  if (!issueState) return false;
  const stateName = String(issueState).trim().toLowerCase();
  return stateName === 'closed' || stateName === '0002';
};

const Ticket = ({
  editorAPI, projectUuid, ticketID, permission, isAdmin, projectName, workspaceID,
  toggleBar, togglePageSlugId
}) => {
  const [isLoading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [ticket, setTicket] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState({});
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isShowCreateKBRecordDialog, setIsShowCreateKBRecordDialog] = useState(false);
  const [isShowCreateTaskDialog, setIsShowCreateTaskDialog] = useState(false);
  const [closeGithubIssuesWarning, setCloseGithubIssuesWarning] = useState(null);
  const [pendingStateUpdate, setPendingStateUpdate] = useState(null);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  const { typesData, statesData, substatesData } = useMetadata();
  const { connections } = useConnections();
  const { modifyLocalRow, getTableByName, deleteRow, insertRowByLink } = useData();
  const { tagsData, createTag } = useTags();
  const { updateAttachments } = useAIChatTools();
  const { loading: isLoadingNotifications, markProjectNoticeAsReadByTicket } = useNotification();

  const lastTicketID = useRef('');

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  // Merge comments and activities into a timeline
  const timeline = useMemo(() => {
    if (!ticket) return [];
    const { comments = [] } = ticket;
    const items = [
      ...comments.map(c => ({ ...c, type: 'comment' })),
      ...activities.map(a => ({ ...a, type: 'log' }))
    ];
    // use original time for sorting: comments use _created_time, activities use created_time
    return items.sort((a, b) => {
      const timeA = a.type === 'comment' ? a._created_time : a.created_time;
      const timeB = b.type === 'comment' ? b._created_time : b.created_time;
      return new Date(timeA) - new Date(timeB);
    });
  }, [ticket, activities]);

  const ticketRef = useRef(null);
  const commentEditorRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = useCallback((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const { height } = dom.getBoundingClientRect();
    setIsShowStickyHeader(event.target.scrollTop > height);
  }, [headerRef]);

  const handleUpdateRowsCacheData = useCallback((ticketID, update) => {
    const table = getTableByName(TICKET_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(TICKET_TABLE_NAME, ticketID, convertRowToKeyValue(update, { data: { columns }, typesData, tagsData }));
  }, [typesData, tagsData, getTableByName, modifyLocalRow]);

  // api
  const isOpenLinkedGithubIssuesWarning = useCallback((error) => {
    const response = error?.response;
    const warning = response?.data || {};
    return response?.status === 409 && warning?.warning_type === 'open_linked_github_issues';
  }, []);

  const buildCloseGithubIssuesWarning = useCallback((warning = {}) => {
    const openGithubIssues = (ticket?.linked_connection_records || []).map((linkedRecordKey) => {
      const linkedRecord = linkedRecords[linkedRecordKey] || {};
      if (linkedRecord.connection_type !== GITHUB_ISSUE_CONNECTION_TYPE || isGithubIssueClosed(linkedRecord.state)) {
        return null;
      }

      const parsedKey = parseLinkedRecordKey(linkedRecordKey);
      if (!parsedKey) return null;

      return {
        ...parsedKey,
        title: linkedRecord.title || '',
        state: linkedRecord.state,
        type: linkedRecord.connection_type,
      };
    }).filter(Boolean);

    return {
      ...warning,
      tickets: [{
        ticket_id: ticket?.id || ticketID,
        ticket_title: ticket?.title || '',
        open_github_issues: openGithubIssues,
      }],
    };
  }, [ticket, ticketID, linkedRecords]);

  const modifyTicket = useCallback((ticketID, data, { confirmCloseLinkedGithubIssues = false } = {}) => {
    let serverData = {};
    const dataKeys = Object.keys(data);
    const isAutoUpdateParticipants = !dataKeys.includes(AUTO_UPDATE_PARTICIPANTS_KEY);

    dataKeys.filter(key => key !== AUTO_UPDATE_PARTICIPANTS_KEY).forEach(columnName => {
      let value = data[columnName];
      if (columnName === PREDEFINED_TICKET_COLUMN_NAME.TYPE && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.STATE && value) {
        value = getRowById(statesData, value)?.origin_name;
      } else if (columnName === PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE && value) {
        value = getRowById(substatesData, value)?.origin_name;
      }
      serverData[columnName] = value;
    });
    if (confirmCloseLinkedGithubIssues) {
      serverData.confirm_close_linked_github_issues = true;
    }

    return ticketsAPI.modifyProjectTicket(projectUuid, ticketID, serverData).then(res => {
      let update = { ...data };
      const { participants = [] } = ticket;
      if (isAutoUpdateParticipants && !participants.includes(user.email)) {
        update['participants'] = [...participants, user.email];
      }
      if (hasOwnProperty(res.data.row, PREDEFINED_TICKET_COLUMN_NAME.CONTENT)) {
        update[PREDEFINED_TICKET_COLUMN_NAME.CONTENT] = res.data.row[PREDEFINED_TICKET_COLUMN_NAME.CONTENT];
      }
      const newTicket = ticket._update(update);
      handleUpdateRowsCacheData(ticketID, update);
      setTicket(deepCopy(newTicket));

      // update activities to immediately display new changes
      const newActivities = res.data.activities || [];
      if (newActivities.length > 0) {
        setActivities(prevActivities => [...prevActivities, ...newActivities]);
      }

      return update;
    });
  }, [projectUuid, ticket, user, tagsData, typesData, statesData, substatesData, handleUpdateRowsCacheData]);

  const tryCloseTicketState = useCallback((state = '', substate = '', { confirmCloseLinkedGithubIssues = false } = {}) => {
    return modifyTicket(ticket.id, { state, substate }, { confirmCloseLinkedGithubIssues }).catch(error => {
      if (!confirmCloseLinkedGithubIssues && isOpenLinkedGithubIssuesWarning(error)) {
        setPendingStateUpdate({ state, substate });
        setCloseGithubIssuesWarning(buildCloseGithubIssuesWarning(error.response?.data || {}));
        return null;
      }
      throw error;
    });
  }, [ticket, modifyTicket, isOpenLinkedGithubIssuesWarning, buildCloseGithubIssuesWarning]);

  const handleUpdateParticipants = useCallback((ticket) => {
    const { participants = [] } = ticket;
    if (!participants.includes(user.email)) {
      const update = { 'participants': [...participants, user.email] };
      ticket = ticket._update(update);
      handleUpdateRowsCacheData(ticket._id, update);
    }
  }, [user, handleUpdateRowsCacheData]);

  const createComment = useCallback((ticketID, comment) => {
    return ticketsAPI.createProjectTicketComment(projectUuid, ticketID, comment).then(res => {
      let newTicket = ticket._create_comment(res.data.comment);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return res.data.comment;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const modifyComment = useCallback((ticketID, commentID, comment) => {
    return ticketsAPI.modifyProjectTicketComment(projectUuid, ticketID, commentID, comment).then(res => {
      const newTicket = ticket._modify_comment(commentID, res.data.comment);
      const newComment = newTicket._get_comment(commentID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newComment;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const deleteComment = useCallback((ticketID, commentID) => {
    return ticketsAPI.deleteProjectTicketComment(projectUuid, ticketID, commentID).then(res => {
      let newTicket = ticket._delete_comment(commentID);
      handleUpdateParticipants(newTicket);
      setTicket(deepCopy(newTicket));
      return newTicket;
    });
  }, [projectUuid, ticket, handleUpdateParticipants]);

  const chatTicketsByAI = useCallback((tickets) => {
    updateAttachments(tickets);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const findRelatedIssues = useCallback(() => {
    setIsShowRelatedIssuesDialog(true);
  }, []);

  const createKnowledgeBaseRecord = useCallback(() => {
    setIsShowCreateKBRecordDialog(true);
  }, []);

  const createTask = useCallback(() => {
    setIsShowCreateTaskDialog(true);
  }, []);

  const handleTaskCreated = useCallback(({ task, connection }) => {
    if (!ticket) return;

    const newValueKey = `${connection.id}_${task._pk}`;
    const oldValue = ticket.linked_connection_records || [];
    const newValue = Array.isArray(oldValue) ? Array.from(new Set([...oldValue, newValueKey])) : [newValueKey];

    // update cache
    const table = getTableByName(TICKET_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length > 0) {
      const linkedConnectionRecordsColumn = getColumnByName(columns, PREDEFINED_TICKET_COLUMN_NAME.LINKED_CONNECTION_RECORDS);
      const update = { [linkedConnectionRecordsColumn.key]: newValue };
      const connectionTableName = getTableName(connection);
      const linked_records = { [newValueKey]: task.title };
      insertRowByLink(connectionTableName, TICKET_TABLE_NAME, linked_records, ticketID, update, () => {
        // nothing todo
      });
    }

    const update = { linked_connection_records: newValue };
    const newTicket = ticket._update(update);

    setTicket(deepCopy(newTicket));
    setLinkedRecords((prev) => ({ ...prev, [newValueKey]: { _pk: task._pk, title: task.title, connection_type: connection.type } }));
  }, [ticket, ticketID, getTableByName, insertRowByLink]);

  const createMoreOptions = useCallback(() => {
    if (!ticket) return [];
    const table = getTableByName(TICKET_TABLE_NAME) || { id_row_map: {}, key_column_map: {} };
    const row = ticket;
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
      chatTicketsByAI,
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
    getTableByName, deleteRow, chatTicketsByAI, findRelatedIssues, createKnowledgeBaseRecord, createTask
  ]);

  const onCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setComment(value);
  }, []);

  const onPriorityChange = useCallback((priority = 0) => {
    modifyTicket(ticket.id, { priority }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onAssigneesChange = useCallback((assignees = []) => {
    modifyTicket(ticket.id, { assignees }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onStateChange = useCallback((state = '', substate = '') => {
    tryCloseTicketState(state, substate).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [tryCloseTicketState]);

  const onSubstateChange = useCallback((substate) => {
    modifyTicket(ticket.id, { substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTypeChange = useCallback((type = '') => {
    modifyTicket(ticket.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onTagsChange = useCallback((tags) => {
    if (!Array.isArray(tags)) return;
    return modifyTicket(ticket.id, { tags }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onContentChange = useCallback((content, callback) => {
    modifyTicket(ticket.id, { content }).then(update => {
      callback && callback('', update.content);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyTicket]);

  const onTitleChange = useCallback((title, callback) => {
    modifyTicket(ticket.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyTicket]);

  const onDueDateChange = useCallback((due_date = '') => {
    modifyTicket(ticket.id, { due_date }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const onParticipantsChange = useCallback((participants = []) => {
    modifyTicket(ticket.id, { participants, [AUTO_UPDATE_PARTICIPANTS_KEY]: true }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [ticket, modifyTicket]);

  const handleFiles = useCallback((files) => {
    if (files.length === 0) return;
    const editor = commentEditorRef.current.getEditor();
    const eventBus = EventBus.getInstance();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = /image/i.test(file.type);
      const fileName = file.name;
      editorAPI.uploadLocalImage(file).then(url => {
        eventBus.dispatch(EXTERNAL_EVENTS.INSERT_ATTACHMENTS, editor, { title: fileName, url, isImage });
      });
    }
  }, [editorAPI]);

  const onSubmitComment = useCallback((callback) => {
    setIsSubmitting(true);
    createComment(ticket.id, comment).then(() => {
      const editor = commentEditorRef.current.getEditor();
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE, editor);
      callback && callback();
      setTimeout(() => {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
        setIsSubmitting(false);
      }, 1);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [comment, ticket, commentEditorRef, createComment]);

  const toggleState = useCallback((state = '', substate = '') => {
    const modifyState = () => {
      tryCloseTicketState(state, substate).then(res => {
        // todo
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
      });
    };
    if (comment && comment?.text) {
      onSubmitComment(modifyState);
      return;
    }

    modifyState();
  }, [comment, tryCloseTicketState, onSubmitComment]);

  const closeGithubIssuesWarningDialog = useCallback(() => {
    if (isConfirmingClose) return;
    setCloseGithubIssuesWarning(null);
    setPendingStateUpdate(null);
  }, [isConfirmingClose]);

  const confirmCloseTicketAndGithubIssues = useCallback(() => {
    if (!pendingStateUpdate) {
      closeGithubIssuesWarningDialog();
      return;
    }
    setIsConfirmingClose(true);
    const { state, substate } = pendingStateUpdate;
    tryCloseTicketState(
      state,
      substate,
      { confirmCloseLinkedGithubIssues: true }
    ).then(() => {
      setCloseGithubIssuesWarning(null);
      setPendingStateUpdate(null);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    }).finally(() => {
      setIsConfirmingClose(false);
    });
  }, [pendingStateUpdate, tryCloseTicketState, closeGithubIssuesWarningDialog]);

  const renderWarningIssueTypeImage = useCallback((type) => {
    const connectionType = type || 'github_issue';
    return (
      <img src={getConnectionIcon(connectionType)} alt="" className="connection-icon" />
    );
  }, []);

  const renderWarningIssueStateIcon = useCallback((issueState) => {
    if (!issueState) return null;
    const stateName = String(issueState).toLowerCase();
    if (stateName === 'open' || stateName === '0001') {
      return <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />;
    }
    if (stateName === 'closed' || stateName === '0002') {
      return <IconTooltip icon="check-circle-stroked" tip={gettext('Closed')} placement="bottom" />;
    }
    return null;
  }, []);

  const handleModifyComment = useCallback((commentID, content, callback) => {
    modifyComment(ticket.id, commentID, content).then(newComment => {
      callback && callback('', newComment?.content);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [ticket, modifyComment]);

  useEffect(() => {
    if (lastTicketID.current === ticketID) return;
    lastTicketID.current = ticketID;
    setLoading(true);
    setTicket(null);
    setActivities([]);
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

    // Load activities
    ticketsAPI.listProjectTicketActivities(projectUuid, ticketID).then(res => {
      setActivities(res.data.activities || []);
    }).catch(error => {
      // Activities loading failure is not critical
      console.error('Failed to load activities:', error);
    });
  }, [projectUuid, ticketID, handleUpdateRowsCacheData, markProjectNoticeAsReadByTicket]);

  useEffect(() => {
    if (isLoading || isLoadingNotifications || !ticket) return;
    markProjectNoticeAsReadByTicket(projectUuid, Number(ticketID));
  }, [projectUuid, isLoading, isLoadingNotifications, ticketID]);

  useEffect(() => {
    if (isLoading || !ticket) return;
    const ticketDom = ticketRef.current;
    const handleResize = () => {
      if (!ticketDom) return;
      setContainerWidth(ticketDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    ticketDom && resizeObserver.observe(ticketDom);

    return () => {
      ticketDom && resizeObserver.unobserve(ticketDom);
    };
  }, [isLoading, ticket]);

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

  const { id, state, title, creator, assignees = [], type, tags, priority, participants = [], substate, due_date, linked_connection_records } = ticket;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const stateOption = TICKET_STATE_CONFIG[state];

  // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 904;
  const lastOpType = timeline.length > 0 ? timeline[timeline.length - 1].type : 'comment';

  return (
    <div
      className={classnames('seaqa-project-ticket', { 'small': isSmallScreen })}
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
      <div className="seaqa-project-ticket-content-wrapper" ref={containerRef}>
        <div className="seaqa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={ticket}
            isShowStatus={true}
            className={classnames({ 'd-none-after': timeline.length === 0 })}
            readonly={!editable}
            lang={lang}
            editorAPI={editorAPI}
            onModify={onContentChange}
          />
          {timeline.map((item, index) => {
            const className = classnames({ 'd-none-after': index === (timeline.length - 1) });
            if (item.type === 'log') {
              return (
                <TicketLog
                  key={`ticket-log-${item.id}`}
                  log={item}
                  projectUuid={projectUuid}
                  className={className}
                  isSmallScreen={isSmallScreen}
                />
              );
            }
            return (
              <Comment
                key={`comment-${item.id}`}
                isSmallScreen={isSmallScreen}
                readonly={!(item.creator === user.email || isAdmin)}
                comment={item}
                className={className}
                projectUuid={projectUuid}
                editorAPI={editorAPI}
                onDelete={(comment) => deleteComment(id, comment.id)}
                onModify={(content, callback) => handleModifyComment(item.id, content, callback)}
              />
            );
          })}
          <Comment
            className={classnames('seaqa-project-ticket-add-comment d-none-after mb-0', { 'mt-4': lastOpType === 'log', 'mt-3': lastOpType === 'comment' })}
            isSmallScreen={isSmallScreen}
            comment={{ creator: username }}
            onSubmitComment={onSubmitComment}
          >
            <span className="seaqa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
            <LongTextInlineEditor
              isAlwaysEnableEdit={true}
              ref={commentEditorRef}
              lang={lang}
              headerName={gettext('Comment')}
              value={comment || ''}
              autoSave={false}
              saveDelay={20 * 1000}
              isCheckBrowser={true}
              isImageUploadOnly={false}
              isSupportMultipleFiles={true}
              editorApi={editorAPI}
              onSaveEditorValue={onCommentChange}
            />
          </Comment>
          <div className="seaqa-project-ticket-footer">
            <UploadFilesButton className="mt-4" onChange={handleFiles} />
            <div className="seaqa-project-ticket-submit-btns ml-2">
              <StatusToggleButton
                state={state}
                substate={substate}
                comment={comment?.text}
                disabled={isSubmitting}
                useMetadataContext={useMetadata}
                onChange={toggleState}
              />
              <Button
                className="seaqa-project-ticket-footer-confirm-btn"
                disabled={!comment.text || isSubmitting}
                color="primary"
                onClick={() => onSubmitComment()}
              >
                {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
              </Button>
            </div>
          </div>
        </div>
        <div className="seaqa-project-ticket-other-settings">
          <PrioritySettings isReadonly={!editable} value={priority} onChange={onPriorityChange} />
          <CollaboratorsSettings
            id="assignees-editor-popover"
            isReadonly={!editable}
            title={gettext('Assignees')}
            value={assignees}
            tip={gettext('No one assigned')}
            useCollaborators={useCollaborators}
            onChange={onAssigneesChange}
          />
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={!editable}
            value={tags}
            tagsData={tagsData}
            createTag={createTag}
            onChange={onTagsChange}
          />
          <StateSettings isReadonly={!editable} state={state} substate={substate} useMetadataContext={useMetadata} onChange={onStateChange} />
          <SubStateSettings isReadonly={!editable} state={state} substate={substate} useMetadataContext={useMetadata} onChange={onSubstateChange} />
          <TypeSettings id="type-editor-popover" isReadonly={!editable} value={type} useMetadataContext={useMetadata} onChange={onTypeChange} />
          <DueDateSettings isReadonly={!editable} value={due_date} onChange={onDueDateChange} />
          <CollaboratorsSettings
            isReadonly={!editable}
            title={gettext('Participants')}
            value={participants}
            useCollaborators={useCollaborators}
            tip={gettext('No participants')}
            onChange={onParticipantsChange}
          />
          <LinkSettings value={linked_connection_records} linkedRecords={linkedRecords} />
        </div>
      </div>
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
          onClose={() => setIsShowCreateTaskDialog(false)}
          onSubmitCallback={handleTaskCreated}
        />
      )}
      {closeGithubIssuesWarning && (
        <Modal isOpen={true} toggle={closeGithubIssuesWarningDialog}>
          <ModalHeader toggle={closeGithubIssuesWarningDialog}>{gettext('Linked GitHub issues are still open')}</ModalHeader>
          <ModalBody>
            <p className="mb-2">
              {gettext('Confirm to close this ticket and close linked GitHub issues at the same time.')}
            </p>
            {(closeGithubIssuesWarning.tickets || []).map((ticketWarning) => (
              <div key={ticketWarning.ticket_id} className="mb-2">
                <div className="fw-bold">
                  {gettext('Ticket')} #{ticketWarning.ticket_id}: {ticketWarning.ticket_title || ''}
                </div>
                <div className="close-github-issues-warning-content">
                  {(ticketWarning.open_github_issues || []).map((issue) => (
                    <div className="link-item" key={`${issue.connection_id}-${issue.record_pk}`}>
                      {renderWarningIssueTypeImage(issue.type)}
                      <span className="link-item-name" title={issue.title || ''}>
                        #{issue.record_pk} {issue.title || ''}
                      </span>
                      {renderWarningIssueStateIcon(issue.state)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={closeGithubIssuesWarningDialog} disabled={isConfirmingClose}>
              {gettext('Cancel')}
            </Button>
            <Button color="primary" onClick={confirmCloseTicketAndGithubIssues} disabled={isConfirmingClose}>
              {gettext('Confirm and close')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default Ticket;
