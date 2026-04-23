import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { LongTextInlineEditor, EventBus, EXTERNAL_EVENTS } from '@seafile/seafile-editor';
import { isLongTextValueExceedLimit } from '@/utils/long-text';
import { CenteredLoading, toaster, EmptyTip } from '@/components';
import {
  PORTAL_ISSUE_STATE_CONFIG, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME, PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID,
  AUTO_UPDATE_PARTICIPANTS_KEY,
} from '../../constants';
import { BAR_TYPE } from '@/project/constants';
import { generatorIssuesContextMenuOptions } from '../../utils';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import {
  gettext, name, username, avatarURL, lang, LONG_TEXT_EXCEED_LIMIT_MESSAGE, mediaUrl,
  PERMISSION_TYPES, server, siteRoot,
} from '@/constants';
import { Utils } from '@/utils/utils';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings, LinkSettings,
} from '@/project/main-panel/tickets/components/ticket-settings';
import { Comment, KeyboardShortcuts, UploadFilesButton } from '@/project/main-panel/tickets/components';
import StatusToggleButton from '@/project/main-panel/tickets/view/ticket/status-toggle-btn';
import { portalAPI } from '@/portal/api';
import { Issus as IssusModel } from '../../models';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import { useData, useTags } from '@/project/hooks';
import { usePortalIssuesMetadata } from '../../hooks';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import Header from '@/project/main-panel/tickets/view/ticket/header';
import { isObject } from '@/utils/type-detection';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { getColumnByName } from '@/sea-metadata/utils/column';

import '@/project/main-panel/tickets/view/ticket/index.css';

const Issue = ({
  editorAPI, projectUuid, issueID, permission, isAdmin, projectName, workspaceID,
  canChatWithAI = false,
  toggleBar, togglePageSlugId,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [issue, setIssue] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState({});
  const [isShowCreateTicketDialog, setIsShowCreateTicketDialog] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const { typesData, statesData, substatesData } = usePortalIssuesMetadata();
  const { modifyLocalRow, getTableByName, deleteRow, insertRowByLink, modifyRowLink } = useData();
  const { tagsData, createTag } = useTags();
  const { updateAttachments } = useAIChatTools();

  const lastIssueID = useRef('');
  const allColumns = useRef([]);

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const issueRef = useRef(null);
  const commentEditorRef = useRef(null);
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = useCallback((event) => {
    if (!event) return;
    const dom = headerRef.current.getDom();
    const { height } = dom.getBoundingClientRect();
    setIsShowStickyHeader(event.target.scrollTop > height);
  }, [headerRef]);

  const handleUpdateRowsCacheData = useCallback((issueID, update) => {
    const table = getTableByName(PORTAL_ISSUE_TABLE_NAME);
    const columns = Object.values(table.key_column_map);
    if (columns.length === 0) return;
    modifyLocalRow(PORTAL_ISSUE_TABLE_NAME, issueID, convertRowToKeyValue(update, { data: { columns }, typesData, tagsData }));
  }, [typesData, tagsData, getTableByName, modifyLocalRow]);

  // api
  const modifyIssue = useCallback((issueID, data) => {
    let serverData = {};
    const dataKeys = Object.keys(data);
    const isAutoUpdateParticipants = !dataKeys.includes(AUTO_UPDATE_PARTICIPANTS_KEY);

    dataKeys.filter(key => key !== AUTO_UPDATE_PARTICIPANTS_KEY).forEach(columnName => {
      let value = data[columnName];
      if (columnName === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption.name;
      } else if (columnName === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE && value) {
        value = getRowById(statesData, value)?.origin_name;
      } else if (columnName === PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.SUB_STATE && value) {
        value = getRowById(substatesData, value)?.origin_name;
      }
      serverData[columnName] = value;
    });

    return portalAPI.modifyPortalIssue(projectUuid, issueID, serverData).then(res => {
      let update = { ...data };
      const { participants = [] } = issue;
      if (isAutoUpdateParticipants && !participants.includes(user.email)) {
        update['participants'] = [...participants, user.email];
      }
      const newIssue = issue._update(update);
      handleUpdateRowsCacheData(issueID, update);
      setIssue(deepCopy(newIssue));

      return data;
    });
  }, [projectUuid, issue, user, tagsData, typesData, statesData, substatesData, handleUpdateRowsCacheData]);

  const handleUpdateParticipants = useCallback((issue) => {
    const { participants = [] } = issue;
    if (!participants.includes(user.email)) {
      const update = { 'participants': [...participants, user.email] };
      issue = issue._update(update);
      handleUpdateRowsCacheData(issue._id, update);
    }
  }, [user, handleUpdateRowsCacheData]);

  const createComment = useCallback((issueID, comment) => {
    return portalAPI.createPortalIssueComment(projectUuid, issueID, comment).then(res => {
      let newIssue = issue._create_comment(res.data.comment);
      handleUpdateParticipants(newIssue);
      setIssue(deepCopy(newIssue));
      return res.data.comment;
    });
  }, [projectUuid, issue, handleUpdateParticipants]);

  const modifyComment = useCallback((issueID, commentID, comment) => {
    return portalAPI.modifyPortalIssueComment(projectUuid, issueID, commentID, comment).then(res => {
      let newIssue = issue._modify_comment(commentID, comment);
      handleUpdateParticipants(newIssue);
      setIssue(deepCopy(newIssue));
      return newIssue;
    });
  }, [projectUuid, issue, handleUpdateParticipants]);

  const deleteComment = useCallback((issueID, commentID) => {
    return portalAPI.deletePortalIssueComment(projectUuid, issueID, commentID).then(res => {
      let newIssue = issue._delete_comment(commentID);
      handleUpdateParticipants(newIssue);
      setIssue(deepCopy(newIssue));
      return newIssue;
    });
  }, [projectUuid, issue, handleUpdateParticipants]);

  const chatIssuesByAI = useCallback((issues) => {
    updateAttachments(issues);
    toggleBar([BAR_TYPE.CHAT]);
  }, [toggleBar, updateAttachments]);

  const createMoreOptions = useCallback(() => {
    if (!issue) return [];
    const table = getTableByName(PORTAL_ISSUE_TABLE_NAME) || { id_row_map: {}, key_column_map: {} };
    const row = issue;
    let options = generatorIssuesContextMenuOptions({
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row.id]: row }, columns: Object.values(table.key_column_map) },
      rowMetrics: { idSelectedRowMap: {} },
      canDeleteRow: true,
      deleteRow: (_) => {
        deleteRow(PORTAL_ISSUE_TABLE_NAME, row.id, () => portalAPI.deletePortalIssue(projectUuid, row.id))
          .then(() => {
            toaster.success(gettext('Issue deleted'));
            togglePageSlugId(PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID.ALL);
          })
          .catch((error) => {
            toaster.danger(Utils.getErrorMsg(error));
          });
      },
      rowGetterByIndex: () => row,
      chatIssuesByAI: canChatWithAI ? chatIssuesByAI : undefined,
      togglePageSlugId: () => {},
      workspaceID,
      projectName,
    });
    options = options.filter(item => (isObject(item) && item?.key !== 'open_issue') || !isObject(item));
    if (options[0] === 'Divider') {
      options.shift();
    }
    if (options[options.length - 1] !== 'Divider') {
      options.push('Divider');
    }
    options.push({
      label: gettext('Open keyboard shortcuts'),
      key: 'open_keyboard_shortcuts',
      callback: () => setIsShowKeyboardShortcuts(true),
    });
    return options;
  }, [issue, getTableByName, deleteRow, canChatWithAI, chatIssuesByAI, projectUuid, workspaceID, projectName]);

  const onCommentChange = useCallback((value) => {
    if (isLongTextValueExceedLimit(value)) {
      toaster.closeAll();
      toaster.danger(LONG_TEXT_EXCEED_LIMIT_MESSAGE, { duration: null });
      return;
    }
    setComment(value);
  }, []);

  const onPriorityChange = useCallback((priority = 0) => {
    modifyIssue(issue.id, { priority }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onAssigneesChange = useCallback((assignees = []) => {
    modifyIssue(issue.id, { assignees }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onStateChange = useCallback((state = '', substate = '') => {
    modifyIssue(issue.id, { state, substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onSubstateChange = useCallback((substate) => {
    modifyIssue(issue.id, { substate }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onTypeChange = useCallback((type = '') => {
    modifyIssue(issue.id, { type }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onTagsChange = useCallback((tags) => {
    if (!Array.isArray(tags)) return;
    return modifyIssue(issue.id, { tags }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onContentChange = useCallback((content, callback) => {
    modifyIssue(issue.id, { content }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [issue, modifyIssue]);

  const onTitleChange = useCallback((title, callback) => {
    modifyIssue(issue.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [issue, modifyIssue]);

  const onDueDateChange = useCallback((due_date = '') => {
    modifyIssue(issue.id, { due_date }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

  const onParticipantsChange = useCallback((participants = []) => {
    modifyIssue(issue.id, { participants, [AUTO_UPDATE_PARTICIPANTS_KEY]: true }).then(res => {
      // todo
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [issue, modifyIssue]);

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
    createComment(issue.id, comment).then(() => {
      const editor = commentEditorRef.current.getEditor();
      const eventBus = EventBus.getInstance();
      eventBus.dispatch(EXTERNAL_EVENTS.CLEAR_ARTICLE, editor);
      callback && callback();
      setTimeout(() => {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
        setIsSubmitting(false);
      }, 1);
    }).catch(error => {
      console.log(error);
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setIsSubmitting(false);
    });
  }, [comment, issue, commentEditorRef, createComment]);

  const toggleState = useCallback((state = '', substate = '') => {
    const modifyState = () => {
      modifyIssue(issue.id, { state, substate }).then(res => {
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
  }, [issue, comment, modifyIssue, onSubmitComment]);

  const handleModifyComment = useCallback((commentID, content, callback) => {
    modifyComment(issue.id, commentID, content).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [issue, modifyComment]);

  const createTicketCallback = useCallback((ticket) => {
    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const linkColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, PORTAL_ISSUE_TABLE_NAME, linkedUpdateRecord, issueID, rowUpdateData, () => {
      setIssue({ ...issue, ...rowUpdateData });
      setLinkedRecords(linkedUpdateRecord);
    });
  }, [issue, issueID, insertRowByLink]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const linkedTicketColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const rowId = issue._id;
    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`portal_${rowId}`] },
      linked_records: { [`portal_${rowId}`]: issue.title }
    }, {
      tableName: PORTAL_ISSUE_TABLE_NAME,
      rowId: rowId,
      rowUpdate: rowUpdate,
      linked_records: linkedUpdateRecord,
    }, () => {
      return portalAPI.modifyPortalIssue(projectUuid, rowId, { [linkedTicketColumn.name]: ticket.id }).then(res => {
        setIssue({ ...issue, [linkedTicketColumn.name]: ticket.id });
        setLinkedRecords(linkedUpdateRecord);
        callback && callback();
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback(true);
      });
    });
  }, [issue, modifyRowLink]);

  useEffect(() => {
    if (lastIssueID.current === issueID) return;
    lastIssueID.current = issueID;
    setLoading(true);
    setIssue(null);
    setLoadError('');

    portalAPI.getPortalIssue(projectUuid, issueID).then(res => {
      handleUpdateRowsCacheData(issueID, res.data.issue);
      allColumns.current = res.data?.columns || [];
      const issue = new IssusModel(res.data.issue);
      setLoadError(res.data?.error_msg || '');
      setIssue(issue);
      setLinkedRecords({ [issue.linked_ticket || '']: res.data?.linked_ticket_title || '' });
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, issueID, handleUpdateRowsCacheData]);

  useEffect(() => {
    if (isLoading || !issue) return;
    const dom = issueRef.current;
    const handleResize = () => {
      if (!dom) return;
      setContainerWidth(dom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    dom && resizeObserver.observe(dom);

    return () => {
      dom && resizeObserver.unobserve(dom);
    };
  }, [isLoading, issue]);

  if (isLoading) return (<CenteredLoading />);
  if (!issue) {
    const emptyText = loadError || gettext('Not found issue');
    return (
      <EmptyTip
        src={`${mediaUrl}img/no-items-tip.png`}
        text={emptyText}
      />
    );
  }

  const { id, state, title, creator, assignees = [], type, tags, priority, participants = [], substate, due_date, linked_ticket } = issue;
  const typeOption = getRowById(typesData, type);
  const editable = creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  const stateOption = PORTAL_ISSUE_STATE_CONFIG[state];

  // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 904;
  const comments = Array.isArray(issue.comments) ? issue.comments : [];

  return (
    <div
      className={classnames('sea-qa-project-ticket', { 'small': isSmallScreen })}
      onScroll={handleScroll}
      ref={issueRef}
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
        className={classnames('sea-qa-project-ticket-simple-info-wrapper-sticky', { 'd-none': !isShowStickyHeader })}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
      />
      <div className="sea-qa-project-ticket-content-wrapper" ref={containerRef}>
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={issue}
            isShowStatus={true}
            className="d-none-after"
            readonly={!editable}
            lang={lang}
            editorAPI={editorAPI}
            onModify={onContentChange}
          />
          {comments.map((comment, index) => {
            return (
              <Comment
                key={`comment-${comment.id}`}
                isSmallScreen={isSmallScreen}
                readonly={!(comment.creator === user.email || isAdmin)}
                comment={comment}
                className="d-none-after"
                projectUuid={projectUuid}
                editorAPI={editorAPI}
                onDelete={(comment) => deleteComment(id, comment.id)}
                onModify={(content, callback) => handleModifyComment(comment.id, content, callback)}
              />
            );
          })}
          <Comment
            className="sea-qa-project-ticket-add-comment d-none-after mb-0 mt-3"
            isSmallScreen={isSmallScreen}
            comment={{ creator: username }}
            onSubmitComment={onSubmitComment}
          >
            <span className="sea-qa-project-ticket-add-comment-title">{gettext('Add a comment')}</span>
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
          <div className="sea-qa-project-ticket-footer">
            <UploadFilesButton className="mt-4" onChange={handleFiles} />
            <div className="sea-qa-project-ticket-submit-btns ml-2">
              <StatusToggleButton state={state} substate={substate} comment={comment?.text} disabled={isSubmitting} onChange={toggleState} />
              <Button
                className="sea-qa-project-ticket-footer-confirm-btn"
                disabled={!comment.text || isSubmitting}
                color="primary"
                onClick={() => onSubmitComment()}
              >
                {isSubmitting ? (<CenteredLoading />) : gettext('Comment')}
              </Button>
            </div>
          </div>
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <PrioritySettings isReadonly={!editable} value={priority} onChange={onPriorityChange} />
          <CollaboratorsSettings id="assignees-editor-popover" isReadonly={!editable} title={gettext('Assignees')} value={assignees} onChange={onAssigneesChange} />
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={!editable}
            value={tags}
            tagsData={tagsData}
            createTag={createTag}
            onChange={onTagsChange}
          />
          <StateSettings isReadonly={!editable} state={state} substate={substate} useMetadataContext={usePortalIssuesMetadata} onChange={onStateChange} />
          <SubStateSettings isReadonly={!editable} state={state} substate={substate} useMetadataContext={usePortalIssuesMetadata} onChange={onSubstateChange} />
          <TypeSettings id="type-editor-popover" isReadonly={!editable} value={type} useMetadataContext={usePortalIssuesMetadata} onChange={onTypeChange} />
          <DueDateSettings isReadonly={!editable} value={due_date} onChange={onDueDateChange} />
          <CollaboratorsSettings isReadonly={!editable} title={gettext('Participants')} value={participants} onChange={onParticipantsChange} />
          <LinkSettings value={[linked_ticket]} linkedRecords={linkedRecords} />
        </div>
      </div>
      {isShowKeyboardShortcuts && (
        <KeyboardShortcuts toggle={() => setIsShowKeyboardShortcuts(false)} />
      )}
      {isShowCreateTicketDialog && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={issue}
          linkedRecordPrefix="portal"
          useMetadataContext={usePortalIssuesMetadata}
          onClose={() => setIsShowCreateTicketDialog(false)}
          convertToTicket={() => {
            return portalAPI.convertPortalIssueToTicket(projectUuid, issueID).then(res => {
              const relatedUrl = `${server}${siteRoot}`;
              return {
                data: {
                  ...res?.data,
                  related_url: relatedUrl + (res?.data?.related_url || '').slice(1)
                }
              };
            });
          }}
          onSubmitCallback={(ticket) => createTicketCallback(ticket, issue)}
        />
      )}
      {isShowTicketsDialog && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={setIsShowTicketsDialog(false)}
        />
      )}
    </div>
  );
};

export default Issue;
