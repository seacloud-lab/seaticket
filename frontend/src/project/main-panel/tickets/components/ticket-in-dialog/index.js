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
import {
  convertSubstateToGitHubStateReason,
  generatorLinkedRecordsForClosedGitHubIssues,
} from '../../utils';
import { useCloseLinkedIssues } from '../../hooks';

import './index.css';

const TicketInDialog = ({
  ticketID,
  projectUuid,
  columns: propsColumns = [],
  permission,
  updateTicket,
  ticketType = TICKET_TYPE,
  getTicket = (projectUuid, ticketID) => ticketsAPI.getProjectTicket(projectUuid, ticketID),
}) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [linkedRecords, setLinkedRecords] = useState({});
  const { getTableByName, modifyLocalRow } = useData();
  const { tagsData, createTag } = useTags();
  const { openCloseLinkedGitHubIssuesWarningDialog } = useCloseLinkedIssues();

  const ticketRef = useRef(null);

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

  const modifyTicket = useCallback((currentTicketID, data, { linkedGithubIssuesToClose = null } = {}) => {
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
    if (linkedGithubIssuesToClose) {
      serverData.linked_github_issues_to_close = linkedGithubIssuesToClose;
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
        return deepCopy(nextTicket);
      });
      return update;
    });
  }, [ticketType, projectUuid, typesData, statesData, substatesData, handleUpdateRowsCacheData, ticket]);

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
    if (ticketType !== TICKET_TYPE) {
      modifyTicket(ticket.id, { state, substate }).catch(handleModifyError);
      return;
    }

    const nextStateName = (getRowById(statesData, state)?.origin_name || '').toLowerCase();
    const isClosing = nextStateName === 'closed';
    const openGithubIssues = Object.entries(linkedRecords || {}).reduce((issues, [key, record]) => {
      if (!record || record.connection_type !== 'github_issue') return issues;
      const issueState = (record.state || '').toString().toLowerCase();
      if (issueState === 'closed' || issueState === '0002') return issues;
      const [connectionId, recordPk] = key.split('_', 2);
      const parsedConnectionId = Number(connectionId);
      const parsedRecordPk = Number(recordPk);
      if (!Number.isInteger(parsedConnectionId) || !Number.isInteger(parsedRecordPk)) return issues;
      issues.push({
        connection_id: parsedConnectionId,
        record_pk: parsedRecordPk,
        title: record.title || '',
        state: record.state,
      });
      return issues;
    }, []);

    if (isClosing && openGithubIssues.length > 0) {
      const tickets = [{
        ticket_id: Number(ticket.id),
        ticket_title: ticket.title || '',
        open_github_issues: openGithubIssues,
      }];
      openCloseLinkedGitHubIssuesWarningDialog({
        tickets,
        stateReason: convertSubstateToGitHubStateReason(getRowById(substatesData, substate)?.origin_name),
        callback: () => {
          return modifyTicket(ticket.id, { state, substate }, {
            linkedGithubIssuesToClose: tickets,
          }).then(() => {
            setLinkedRecords(pre => generatorLinkedRecordsForClosedGitHubIssues(pre, openGithubIssues));
          });
        },
      });
      return;
    }

    modifyTicket(ticket.id, { state, substate }).catch(handleModifyError);
  }, [ticket, ticketType, statesData, substatesData, linkedRecords, modifyTicket, handleModifyError, openCloseLinkedGitHubIssuesWarningDialog]);

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
  );
};

export default TicketInDialog;
