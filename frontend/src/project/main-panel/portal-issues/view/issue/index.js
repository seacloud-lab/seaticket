import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { CenteredLoading, toaster, EmptyTip, IconButton } from '@/components';
import {
  gettext, name, username, avatarURL, mediaUrl,
  PERMISSION_TYPES,
} from '@/constants';
import { portalAPI } from '@/portal/api';
import { useData, useTags } from '@/project/hooks';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import { KeyboardShortcuts } from '@/project/main-panel/tickets/components';
import TicketDetails from '@/project/main-panel/tickets/components/ticket-details';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';
import { TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import Header from '@/project/main-panel/tickets/view/ticket/header';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { convertRowToKeyValue, getRowById } from '@/sea-metadata/utils/row';
import { isFunction, isObject } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import {
  PORTAL_ISSUE_STATE_CONFIG, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME, PORTAL_ISSUE_TABLE_NAME, PORTAL_ISSUE_CHILDREN_PAGE_SLUG_ID,
  PORTAL_ISSUE_TYPE,
} from '../../constants';
import { usePortalIssuesMetadata } from '../../hooks';
import { Issus as IssusModel } from '../../models';
import { generatorIssuesContextMenuOptions } from '../../utils';

import '@/project/main-panel/tickets/view/ticket/index.css';

const Issue = ({
  projectUuid, issueID, permission, isAdmin = false, projectName, workspaceID, isBuiltInView,
  canEditAllIssues = permission === PERMISSION_TYPES.READ_WRITE,
  canChatWithAI = false,
  isMobile = false,
  isShowCustomer = true,
  togglePageSlugId = () => {},
  generatorIssuesContextMenuOptions: customGeneratorIssuesContextMenuOptions,
}) => {
  const [isLoading, setLoading] = useState(true);
  const [issue, setIssue] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isShowStickyHeader, setIsShowStickyHeader] = useState(false);
  const [isShowKeyboardShortcuts, setIsShowKeyboardShortcuts] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState({});
  const [isShowCreateTicketDialog, setIsShowCreateTicketDialog] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const { typesData } = usePortalIssuesMetadata();
  const { modifyLocalRow, getTableByName, deleteRow, insertRowByLink, modifyRowLink } = useData();
  const { tagsData } = useTags();
  const { handleResolveAttachmentsByAI } = useAIChatTools();

  const lastIssueID = useRef('');
  const allColumns = useRef([]);
  const issueDetailsRef = useRef(null);

  const user = useMemo(() => {
    return {
      name,
      email: username,
      avatar_url: avatarURL
    };
  }, []);

  const editable = Boolean(issue && (issue.creator === user.email || canEditAllIssues));
  const canModifyIssue = editable && !isBuiltInView && !isMobile;

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
  const modifyIssue = useCallback((projectUuid, issueID, data) => {
    return portalAPI.modifyPortalIssue(projectUuid, issueID, data);
  }, []);

  const createComment = useCallback((projectUuid, issueID, comment) => {
    return portalAPI.createPortalIssueComment(projectUuid, issueID, comment);
  }, []);

  const modifyComment = useCallback((projectUuid, issueID, commentID, comment) => {
    return portalAPI.modifyPortalIssueComment(projectUuid, issueID, commentID, comment);
  }, []);

  const deleteComment = useCallback((projectUuid, issueID, commentID) => {
    return portalAPI.deletePortalIssueComment(projectUuid, issueID, commentID);
  }, []);

  const createTicket = useCallback(() => {
    setIsShowCreateTicketDialog(true);
  }, []);

  const handleLinkAnExistingTicket = useCallback(() => {
    setIsShowTicketsDialog(true);
  }, []);

  const createMoreOptions = useCallback(() => {
    if (!issue) return [];
    const row = issue;
    const params = {
      isGroupView: false,
      selectedPosition: { groupRowIndex: 0, rowIdx: 0 },
      table: { id_row_map: { [row.id]: row }, columns: allColumns.current },
      rowMetrics: { idSelectedRowMap: {} },
      canDeleteRow: editable,
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
      chatIssuesByAI: canChatWithAI ? handleResolveAttachmentsByAI : undefined,
      createTicket: editable ? createTicket : undefined,
      linkAnExistingTicket: editable ? handleLinkAnExistingTicket : undefined,
      togglePageSlugId: () => {},
      workspaceID,
      projectName,
    };
    let options = [];
    if (isFunction(customGeneratorIssuesContextMenuOptions)) {
      options = customGeneratorIssuesContextMenuOptions(params);
    } else {
      options = generatorIssuesContextMenuOptions(params);
    }
    options = options.filter(item => {
      if (!isObject(item)) return true;
      if (item.key === 'open_issue') return false;
      return editable || !['create_ticket', 'link_an_existing_ticket', 'delete_row'].includes(item.key);
    });
    if (options[options.length - 1] !== 'Divider') {
      options.push('Divider');
    }
    options.push({
      label: gettext('Open keyboard shortcuts'),
      key: 'open_keyboard_shortcuts',
      callback: () => setIsShowKeyboardShortcuts(true),
    });
    if (options[0] === 'Divider') {
      options.shift();
    }
    return options;
  }, [
    issue, deleteRow, canChatWithAI, handleResolveAttachmentsByAI, projectUuid, workspaceID, projectName, editable,
    createTicket, handleLinkAnExistingTicket, customGeneratorIssuesContextMenuOptions, togglePageSlugId,
  ]);

  const onTitleChange = useCallback((title, callback) => {
    issueDetailsRef.current.onChange(issue.id, { title }).then(res => {
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback(error);
    });
  }, [issue, issueDetailsRef]);

  const createTicketCallback = useCallback((ticket) => {
    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const linkColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, PORTAL_ISSUE_TABLE_NAME, linkedUpdateRecord, issueID, rowUpdateData, () => {
      let update = { [linkColumn.name]: ticket._pk };
      const newIssue = issue._update(update);
      handleUpdateRowsCacheData(issueID, rowUpdateData);
      setIssue(deepCopy(newIssue));
      setLinkedRecords({ [ticket._pk]: { title: ticket.title } });
    });
  }, [issue, issueID, insertRowByLink, handleUpdateRowsCacheData]);

  const linkAnExistingTicket = useCallback((ticket, linkedConnectionRecordsColumn, callback) => {
    const linkedTicketColumn = getColumnByName(allColumns.current, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.LINKED_TICKET);
    const rowUpdate = { [linkedTicketColumn.key]: ticket.id };
    const issueLinkedUpdate = { [ticket.id]: ticket.title };
    const rowId = issue.id;
    modifyRowLink({
      tableName: TICKET_TABLE_NAME,
      rowId: String(ticket.id),
      rowUpdate: { [linkedConnectionRecordsColumn.key]: [`portal_${rowId}`] },
      linkedRecords: { [`portal_${rowId}`]: issue.title }
    }, {
      tableName: PORTAL_ISSUE_TABLE_NAME,
      rowId: rowId,
      rowUpdate: rowUpdate,
      linkedRecords: issueLinkedUpdate,
    }, () => {
      return issueDetailsRef.current.onChange(rowId, { [linkedTicketColumn.name]: ticket.id }).then(res => {
        setLinkedRecords({ [ticket.id]: { title: ticket.title } });
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
      setLinkedRecords(issue.linked_ticket ? { [issue.linked_ticket]: { title: res.data?.linked_ticket_title || '' } } : {});
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, issueID, handleUpdateRowsCacheData]);

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

  const { id, state, title, type } = issue;
  const typeOption = getRowById(typesData, type);
  const stateOption = PORTAL_ISSUE_STATE_CONFIG[state];

  const renderBackButton = () => isMobile ? (
    <IconButton
      icon="arrow-down"
      className="rotate-icon-90 seaqa-project-ticket-title-back-btn"
      title={gettext('Back')}
      aria-label={gettext('Back')}
      onClick={togglePageSlugId}
    />
  ) : null;

  return (
    <div
      className={classnames('seaqa-project-ticket')}
      onScroll={handleScroll}
    >
      <Header
        ref={headerRef}
        readonly={!canModifyIssue}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
        titlePrefix={renderBackButton()}
        createMoreOptions={createMoreOptions}
        modifyTitle={onTitleChange}
      />
      <Header
        className={classnames('seaqa-project-ticket-simple-info-wrapper-sticky', { 'd-none': !isShowStickyHeader })}
        title={title}
        id={id}
        stateOption={stateOption}
        typeOption={typeOption}
        titlePrefix={renderBackButton()}
      />
      <TicketDetails
        ref={issueDetailsRef}
        isShowOthersInfo={!isMobile}
        isShowCustomer={isShowCustomer}
        isMobile={isMobile}
        ticketType={PORTAL_ISSUE_TYPE}
        smallScreenSize={904} // 904: comment min-width(596) + others min-width(260) + gap: 16 * 3
        isAdmin={isAdmin}
        permission={editable ? PERMISSION_TYPES.READ_WRITE : permission}
        projectUuid={projectUuid}
        ticket={issue}
        setTicket={setIssue}
        modifyTicket={canModifyIssue ? modifyIssue : undefined}
        linkedRecords={linkedRecords}
        setLinkedRecords={setLinkedRecords}
        createComment={createComment}
        modifyComment={modifyComment}
        deleteComment={deleteComment}
      />
      {isShowKeyboardShortcuts && (
        <KeyboardShortcuts toggle={() => setIsShowKeyboardShortcuts(false)} />
      )}
      {!isMobile && isShowCreateTicketDialog && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={{ _id: issueID }}
          linkedRecordPrefix="portal"
          useMetadataContext={usePortalIssuesMetadata}
          onClose={() => setIsShowCreateTicketDialog(false)}
          convertToTicket={() => {
            return portalAPI.convertPortalIssueToTicket(projectUuid, issueID);
          }}
          onSubmitCallback={(ticket) => createTicketCallback(ticket, issue)}
        />
      )}
      {!isMobile && isShowTicketsDialog && (
        <TicketsDialog
          projectUuid={projectUuid}
          onSubmit={linkAnExistingTicket}
          onToggle={() => setIsShowTicketsDialog(false)}
        />
      )}
    </div>
  );
};

export default Issue;
