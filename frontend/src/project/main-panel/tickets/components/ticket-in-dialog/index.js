import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import classnames from 'classnames';
import deepCopy from 'deep-copy';
import { Ticket as TicketModel } from '../../models';
import { Issus as IssueModel } from '@/project/main-panel/portal-issues/models';
import { Utils } from '@/utils/utils';
import { CenteredError, CenteredLoading, toaster } from '@/components';
import { gettext, lang, PERMISSION_TYPES, name, username, avatarURL } from '@/constants';
import { useData, useTags, useMetadata as useTicketMetadata, usePortalIssuesMetadata } from '@/project/hooks';
import {
  CollaboratorsSettings, TypeSettings, PrioritySettings,
  StateSettings, SubStateSettings, DueDateSettings, LinkSettings
} from '../ticket-settings';
import Comment from '../comment';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { ticketsAPI } from '@/project/api';
import { portalAPI } from '@/portal/api';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { getRowById, convertRowToKeyValue } from '@/sea-metadata/utils/row';
import { TICKET_TYPE, PREDEFINED_TICKET_COLUMN_NAME, TICKET_TABLE_NAME } from '../../constants';
import { PORTAL_ISSUE_TABLE_NAME, PREDEFINED_PORTAL_ISSUE_COLUMN_NAME } from '@/project/main-panel/portal-issues/constants';
import { useCollaborators } from '@/sea-metadata';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE as GLOBAL_EVENT_BUS_TYPE } from '@/project/constants';
import CloseLinkedGitHubIssuesWarningDialog from '../close-linked-github-issues-warning-dialog';
import { useConnections } from '@/project/main-panel/connections/hooks';
import { isOpenLinkedGithubIssuesWarning, convertSubstateToGitHubStateReason } from '../../utils';
import { CONNECTION_PREDEFINED_COLUMN_NAME } from '@/project/main-panel/connections/constants';

import './index.css';

const { permission } = window.app.pageOptions;

const TicketInDialog = ({
  ticketID,
  projectUuid,
  columns: propsColumns = [],
  updateTicket,
  ticketType = TICKET_TYPE,
  getTicket = (projectUuid, ticketID) => ticketsAPI.getProjectTicket(projectUuid, ticketID),
}) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [linkedRecords, setLinkedRecords] = useState({});
  const [isShowCloseGitHubIssuesWarningDialog, setIsShowCloseGitHubIssuesWarningDialog] = useState(false);

  const { getTableByName, modifyLocalRow, modifyLocalGitHubIssuesClosed } = useData();
  const { tagsData, createTag } = useTags();
  const { connections } = useConnections();

  const ticketRef = useRef(null);
  const closeLinkedGitHubIssuesWarning = useRef(null);

  const ticketMetadata = useTicketMetadata();
  const portalIssuesMetadata = usePortalIssuesMetadata();
  const metadata = ticketType === TICKET_TYPE ? ticketMetadata : portalIssuesMetadata;
  const { typesData, statesData, substatesData } = metadata;

  const editable = useMemo(() => {
    if (!ticket) return false;
    const user = {
      name,
      email: username,
      avatar_url: avatarURL
    };
    return ticket.creator === user.email || permission === PERMISSION_TYPES.READ_WRITE;
  }, [ticket]);

  const handleUpdateRowsCacheData = useCallback((currentTicketID, update) => {
    const tableName = ticketType === TICKET_TYPE ? TICKET_TABLE_NAME : PORTAL_ISSUE_TABLE_NAME;
    const table = getTableByName(tableName, null);
    if (!table) return;
    const cacheColumns = Object.values(table?.key_column_map || {});
    const validColumns = propsColumns.length > 0 ? propsColumns : cacheColumns;
    if (validColumns.length === 0) return;

    const localRowUpdate = convertRowToKeyValue(update, { data: { columns: validColumns }, typesData, tagsData });
    if (Object.keys(localRowUpdate).length === 0) return;

    modifyLocalRow(tableName, currentTicketID, localRowUpdate);

    // current is not table, not need to update
    const pathname = window.location.pathname;
    if (pathname.endsWith('/tickets/') || pathname.endsWith('/portal-issues/')) {
      const eventBus = context.eventBus;
      eventBus.dispatch(EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, currentTicketID, localRowUpdate);
    }
  }, [getTableByName, modifyLocalRow, propsColumns, typesData, tagsData]);

  const modifyTicket = useCallback((currentTicketID, data, { confirmCloseLinkedGithubIssues = false } = {}) => {
    let serverData = {};
    const typeColumnName = ticketType === TICKET_TYPE ? PREDEFINED_TICKET_COLUMN_NAME.TYPE : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.TYPE;
    const stateColumnName = ticketType === TICKET_TYPE ? PREDEFINED_TICKET_COLUMN_NAME.STATE : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.STATE;
    const substateColumnName = ticketType === TICKET_TYPE ? PREDEFINED_TICKET_COLUMN_NAME.SUB_STATE : PREDEFINED_PORTAL_ISSUE_COLUMN_NAME.SUB_STATE;

    Object.keys(data).forEach(columnName => {
      let value = data[columnName];
      if (columnName === typeColumnName && value) {
        const typeOption = getRowById(typesData, value);
        value = typeOption?.name || value;
      } else if (columnName === stateColumnName && value) {
        value = getRowById(statesData, value)?.origin_name;
      } else if (columnName === substateColumnName && value) {
        value = getRowById(substatesData, value)?.origin_name;
      }
      serverData[columnName] = value;
    });
    if (confirmCloseLinkedGithubIssues) {
      serverData.confirm_close_linked_github_issues = true;
    }

    const modifyPromise = ticketType === TICKET_TYPE ? ticketsAPI.modifyProjectTicket(projectUuid, currentTicketID, serverData) : portalAPI.modifyPortalIssue(projectUuid, currentTicketID, serverData);
    return modifyPromise.then(() => {
      let update = { ...data };

      if (ticketType === TICKET_TYPE) {
        const participants = ticket?.participants || [];
        if (!Object.prototype.hasOwnProperty.call(update, 'participants') && !participants.includes(username)) {
          update.participants = [...participants, username];
        }
      }

      handleUpdateRowsCacheData(currentTicketID, update);
      setTicket(prev => {
        if (!prev) return prev;
        const nextTicket = prev._update(update);
        const copiedTicket = deepCopy(nextTicket);
        updateTicket(copiedTicket);
        return copiedTicket;
      });
      return update;
    });
  }, [ticketType, projectUuid, typesData, statesData, substatesData, updateTicket, handleUpdateRowsCacheData, ticket]);

  const handleModifyError = useCallback((error) => {
    toaster.danger(Utils.getErrorMsg(error));
  }, []);

  const onPriorityChange = useCallback((priority = 0) => {
    modifyTicket(ticket.id, { priority }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onAssigneesChange = useCallback((assignees = []) => {
    modifyTicket(ticket.id, { assignees }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onStateChange = useCallback((state = '', substate = '') => {
    modifyTicket(ticket.id, { state, substate }).catch(error => {
      if (isOpenLinkedGithubIssuesWarning(error) && ticketType === TICKET_TYPE) {
        const data = error?.response?.data || {};
        closeLinkedGitHubIssuesWarning.current = {
          tickets: data.tickets || [],
          stateReason: convertSubstateToGitHubStateReason(getRowById(substatesData, substate)?.origin_name),
          callback: () => {
            return modifyTicket(ticket.id, { state, substate }, { confirmCloseLinkedGithubIssues: true });
          },
        };
        setIsShowCloseGitHubIssuesWarningDialog(true);
        return;
      }
      handleModifyError(error);
    });
  }, [ticket, ticketType, substatesData, modifyTicket, handleModifyError]);

  const onSubstateChange = useCallback((substate) => {
    modifyTicket(ticket.id, { substate }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onTypeChange = useCallback((type = '') => {
    modifyTicket(ticket.id, { type }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onTagsChange = useCallback((tags) => {
    if (!Array.isArray(tags)) return;
    modifyTicket(ticket.id, { tags }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onDueDateChange = useCallback((due_date = '') => {
    modifyTicket(ticket.id, { due_date }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onParticipantsChange = useCallback((participants = []) => {
    modifyTicket(ticket.id, { participants }).catch(error => {
      handleModifyError(error);
    });
  }, [ticket, modifyTicket, handleModifyError]);

  const onCloseWarningDialog = useCallback(() => {
    setIsShowCloseGitHubIssuesWarningDialog(false);
    closeLinkedGitHubIssuesWarning.current = null;
  }, []);

  const handleCloseLinkedGithubIssues = useCallback((callback) => {
    const { callback: modify, tickets, stateReason } = closeLinkedGitHubIssuesWarning.current;

    modify && modify().then(res => {
      callback && callback();
      const pathname = window.location.pathname;

      // update connection table cache
      const issues = tickets.map(ticket => ticket.open_github_issues).flat();
      modifyLocalGitHubIssuesClosed(issues, connections, stateReason);

      // current is connection table, update current view
      const connectionTableReg = /\/connections\/(\d+)\/$/;
      const connectionTableMatch = pathname.match(connectionTableReg);
      if (connectionTableMatch) {
        const connectionId = Number(connectionTableMatch[1]);
        const currentConnectionIssues = issues.filter(issue => issue.connection_id === connectionId);
        if (currentConnectionIssues.length > 0) {
          const record = {
            [CONNECTION_PREDEFINED_COLUMN_NAME.STATE]: 'closed',
            [CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON]: stateReason,
          };
          const idRecordUpdates = currentConnectionIssues.reduce((_update, cur) => {
            _update[cur.record_pk + ''] = record;
            return _update;
          }, {});
          eventBus.dispatch(GLOBAL_EVENT_BUS_TYPE.MODIFY_LOCAL_RECORDS, idRecordUpdates);
        }
      }

      // current is connection record details, update record details
      const connectionTableRecordReg = /\/connections\/(\d+)\/records\/(\d+)\/$/;
      const connectionTableRecordMatch = pathname.match(connectionTableRecordReg);
      if (connectionTableRecordMatch) {
        const connectionId = Number(connectionTableRecordMatch[1]);
        const recordId = Number(connectionTableRecordMatch[2]);
        const currentConnectionIssue = issues.find(issue => issue.connection_id === connectionId && issue.record_pk === recordId);
        if (currentConnectionIssue) {
          const record = {
            [CONNECTION_PREDEFINED_COLUMN_NAME.STATE]: 'closed',
            [CONNECTION_PREDEFINED_COLUMN_NAME.STATE_REASON]: stateReason,
          };
          eventBus.dispatch(GLOBAL_EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD, record);
        }
      }

      // update linkedRecords
      let linkedRecordsUpdate = {};
      issues.forEach(issue => {
        const { connection_id, record_pk } = issue;
        const key = `${connection_id}_${record_pk}`;
        linkedRecordsUpdate[key] = { state: 'closed' };
      });
      setLinkedRecords(pre => {
        let cur = { ...pre };
        Object.keys(pre).forEach(key => {
          cur[key] = { ...cur[key], ...linkedRecordsUpdate[key] };
        });
        return cur;
      });

      setIsShowCloseGitHubIssuesWarningDialog(false);
      closeLinkedGitHubIssuesWarning.current = null;
    }).catch(error => {
      callback && callback(error);
    });
  }, [connections, modifyLocalGitHubIssuesClosed]);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    setTicket(null);
    getTicket(projectUuid, ticketID).then(res => {
      const ticket = ticketType === TICKET_TYPE ? new TicketModel(res.data.ticket) : new IssueModel(res.data.issue);
      setTicket(ticket);
      updateTicket(ticket);
      const linkedRecords = ticketType === TICKET_TYPE ? res.data?.linked_records_info : { [ticket.linked_ticket || '']: res.data?.linked_ticket_title };
      setLinkedRecords(linkedRecords || {});
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [projectUuid, ticketID, ticketType]);

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

  useEffect(() => {
    const localChanged = (ticket, linkedRecords) => {
      setTicket(cur => ({ ...cur, ...ticket }));
      setLinkedRecords(cur => ({ ...cur, ...linkedRecords }));
    };

    const unsubscribeLocalChanged = eventBus.subscribe(GLOBAL_EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, localChanged);
    return () => {
      unsubscribeLocalChanged();
    };
  }, []);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
  if (!ticket) return (<CenteredError>{ticketType === TICKET_TYPE ? gettext('Ticket not found') : gettext('Issue not found')}</CenteredError>);

  const isSmallScreen = containerWidth < 780;
  const isPortalIssue = ticketType !== TICKET_TYPE;

  const { state, comments = [], assignees = [], type, tags, priority, participants = [], substate, due_date } = ticket;
  return (
    <>
      <div className={classnames('seaqa-project-ticket seaqa-project-ticket-in-dialog', { 'small': isSmallScreen })} ref={ticketRef}>
        <div className="seaqa-project-ticket-content-wrapper">
          <div className="seaqa-project-ticket-comment-container-wrapper">
            <Comment
              isSmallScreen={isSmallScreen}
              comment={ticket}
              isShowStatus={true}
              readonly={true}
              lang={lang}
            />
            {comments.map(comment => {
              return (
                <Comment
                  key={comment.id}
                  isSmallScreen={isSmallScreen}
                  readonly={true}
                  comment={comment}
                  projectUuid={projectUuid}
                />
              );
            })}
          </div>
          <div className="seaqa-project-ticket-other-settings">
            <PrioritySettings isReadonly={!editable} value={priority} onChange={onPriorityChange} />
            {!isPortalIssue && (
              <CollaboratorsSettings
                id="ticket-dialog-assignees-editor-popover"
                isReadonly={!editable}
                title={gettext('Assignees')}
                value={assignees}
                tip={gettext('No one assigned')}
                useCollaborators={useCollaborators}
                onChange={onAssigneesChange}
              />
            )}
            <TagsSettings
              isReadonly={!editable}
              value={tags}
              tagsData={tagsData}
              createTag={createTag}
              onChange={onTagsChange}
            />
            <StateSettings
              isReadonly={!editable}
              state={state}
              substate={substate}
              sameWidthWithTarget={'fit-content'}
              useMetadataContext={() => metadata}
              onChange={onStateChange} />
            <SubStateSettings isReadonly={!editable} state={state} substate={substate} useMetadataContext={() => metadata} onChange={onSubstateChange} />
            <TypeSettings id="ticket-dialog-type-editor-popover" isReadonly={!editable} value={type} useMetadataContext={() => metadata} onChange={onTypeChange} />
            {!isPortalIssue && (
              <DueDateSettings isReadonly={!editable} value={due_date} onChange={onDueDateChange} />
            )}
            {!isPortalIssue && (
              <CollaboratorsSettings
                id="ticket-dialog-participants-editor-popover"
                isReadonly={!editable}
                title={gettext('Participants')}
                value={participants}
                tip={gettext('No participants')}
                useCollaborators={useCollaborators}
                onChange={onParticipantsChange}
              />
            )}
            <LinkSettings
              value={ticketType === TICKET_TYPE ? ticket.linked_connection_records : [ticket.linked_ticket]}
              linkedRecords={linkedRecords}
            />
          </div>
        </div>
      </div>
      {isShowCloseGitHubIssuesWarningDialog && (
        <CloseLinkedGitHubIssuesWarningDialog
          tickets={closeLinkedGitHubIssuesWarning.current.tickets}
          onToggle={onCloseWarningDialog}
          onSubmit={handleCloseLinkedGithubIssues}
        />
      )}
    </>
  );

};

export default TicketInDialog;
