import React, { useState, useCallback, useMemo, useRef } from 'react';
import classnames from 'classnames';
import { connectionsAPI } from '@/project/api';
import context from '@/sea-metadata/context';

// components
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import ActionItem from './action-item';
import RunStatisticsDialog from './run-statistics-dialog';
import ThoughtProcessDialog from './thought-process-dialog';
import { IconTooltip, Icon, toaster } from '@/components';
import { ResourceDetailsDialog } from '@/project/components';
import RelatedIssuesDialog from '@/project/main-panel/connections/components/related-issues-dialog';
import CreateTicketDialog from '@/project/main-panel/connections/components/create-ticket-dialog';
import TicketsDialog from '@/project/main-panel/tickets/components/tickets-dialog';

// hooks
import { useConnections } from '@/project/main-panel/connections/hooks';
import { useAIChatTools } from '@/project/main-panel/ask/hooks';
import { useData, useMetadata } from '@/project/hooks';
import { AttachmentObject } from '@/project/main-panel/ask/models';

// utils
import { normalizeContextMenuOptions, getResourceIconURL } from '@/project/utils';
import DateFormatter from '@/project/main-panel/connections/components/cell-formatter/date-formatter';
import {
  generateAIOptions, generateCreateRelatedTicketOption, generateFindRelatedIssuesOption,
  generateLinkAnExistingTicketOption, generateOpenOriginalPageOption,
  generateCopyOriginalLinkOption, generateMarkAsOutdatedOptions, getTableName,
} from '@/project/main-panel/connections/utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { Utils } from '@/utils/utils';

// constants
import { gettext } from '@/constants';
import { ACTION_STATUS, ACTION_TYPE, RUN_STATUS } from './constants';
import { CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { TICKET_TYPE, TICKET_TABLE_NAME } from '@/project/main-panel/tickets/constants';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE, FROM_NOW } from '@/sea-metadata/constants';

const { projectUuid } = window.app.pageOptions;
const thoughtProcessEnabled = window.app.pageOptions.thoughtProcessEnabled;

const getResourceFromItem = (item) => {
  const { source_type, source_id, source_title } = item;
  const icon = getResourceIconURL(source_type);
  if (source_type === TICKET_TYPE) return { type: TICKET_TYPE, title: source_title, _id: source_id, icon };

  const separatorIndex = source_id.indexOf('_');
  const connectionId = separatorIndex > -1 ? source_id.slice(0, separatorIndex) : '';
  const recordId = separatorIndex > -1 ? source_id.slice(separatorIndex + 1) : '';
  return {
    type: source_type,
    _id: recordId || source_id,
    title: source_title,
    connection_id: connectionId ? Number(connectionId) : null,
    icon: [CONNECTION_TYPE.GITHUB_ISSUE, CONNECTION_TYPE.DISCOURSE_FORUM, CONNECTION_TYPE.EMAIL].includes(source_type) ? icon : getResourceIconURL(TICKET_TYPE),
  };
};

const getResourceTitleTip = (resource) => {
  const { type, _id } = resource;
  if (type === TICKET_TYPE) return `${gettext('Ticket')} #${_id}`;
  if (type === CONNECTION_TYPE.GITHUB_ISSUE) return `${gettext('Github issue')} #${_id}`;
  if (type === CONNECTION_TYPE.DISCOURSE_FORUM) return `${gettext('Discourse Forum')} #${_id}`;
  if (type === CONNECTION_TYPE.EMAIL) return `${gettext('Email')} #${_id}`;
  return `${gettext(type)} #${_id}:`;
};

const RunCardHeader = ({ item }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);
  const [isShowRelatedIssuesDialog, setIsShowRelatedIssuesDialog] = useState(false);
  const [isTicketDialogOpen, setTicketDialogOpen] = useState(false);
  const [isShowTicketsDialog, setIsShowTicketsDialog] = useState(false);

  const actionContextRef = useRef(null);

  const { connections } = useConnections();
  const { updateAttachments } = useAIChatTools();
  const { modifyRow, modifyRowLink, insertRowByLink } = useData();

  const resource = useMemo(() => getResourceFromItem(item), [item]);

  const titleTip = useMemo(() => getResourceTitleTip(resource), [resource]);

  const openDetails = useCallback(() => {
    setIsShowDetails(true);
  }, []);

  const closeDetails = useCallback(() => {
    setIsShowDetails(false);
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
    updateAttachments(attachments.map(attachment => new AttachmentObject(attachment)));
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
  }, [modifyRow]);

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
  }, [
    connections, handleResolveIssueByAI, openRelatedIssuesDialog,
    openCreateTicketDialog, openTicketsDialog, modifyRowsByDetailsMenu
  ]);

  const createTicketCallback = useCallback((ticket) => {
    const actionContext = actionContextRef.current;
    if (!actionContext?.connection || !actionContext?.columns || !actionContext?.row) return;

    const { row, details, updateResourceDetails, columns, connection } = actionContext;
    const linkColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
    if (!linkColumn) return;

    const linkedUpdateRecord = { [ticket._pk]: ticket.title };
    const rowUpdateData = { [linkColumn.key]: [ticket._pk] };
    insertRowByLink(TICKET_TABLE_NAME, getTableName(connection), linkedUpdateRecord, row._id, rowUpdateData, () => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, row._id, rowUpdateData);
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: linkedUpdateRecord }, false);
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
        context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.LOCAL_ROW_CHANGED, rowId, rowUpdate);
        context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.UPDATE_DATA_ATTRIBUTE, { linked_records: connectionLinkedUpdate }, false);
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
        toaster.danger(Utils.getErrorMsg(error));
        callback && callback(true);
      });
    });
  }, [modifyRowLink]);

  const hasDetails = resource.type === TICKET_TYPE || (resource.connection_id && resource._id);

  return (
    <>
      <div className="ticket-header">
        <span className="ticket-icon">
          <img src={resource.icon} alt="Ticket" width={16} height={16} />
        </span>
        <span
          className={classnames('ticket-title text-truncate', { 'cursor-pointer': hasDetails })}
          onClick={hasDetails ? openDetails : () => {}}
        >
          <span>{titleTip}</span>
          <span className="seaqa-text-orange ml-1" title={resource.title}>{resource.title}</span>
        </span>
      </div>
      {isShowDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          createMoreOptions={createMoreOptions}
          onToggle={closeDetails}
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
    </>
  );
};

const normalizeRunEvents = (Events) => {
  if (Array.isArray(Events)) return Events.filter(Boolean);
  if (!Events || typeof Events !== 'object') return [];

  // New schema: bare event object
  if (typeof Events.type === 'string') {
    return [Events];
  }

  return [];
};

const getUniqueEventTypes = (Events) => {
  const normalizedEvents = normalizeRunEvents(Events);
  if (normalizedEvents.length === 0) return [];
  const seen = new Set();
  return normalizedEvents.reduce((acc, e) => {
    const type = e && e.type;
    if (type && !seen.has(type)) {
      seen.add(type);
      acc.push(type);
    }
    return acc;
  }, []);
};

const collectRunActions = (run) => {
  const { items = [], actions = [] } = run;
  const fromItems = items.flatMap(item => item.actions || []);
  return [...fromItems, ...actions];
};

const runHasSuggestionAction = (run) =>
  collectRunActions(run).some(a => a && a.type === ACTION_TYPE.SUGGESTION);

const RunCard = ({
  run,
  onConfirmAction,
  onCancelAction,
  onViewContent,
}) => {
  const { id, started_at, items = [], actions = [], events } = run;
  const eventTypes = getUniqueEventTypes(events);

  let isShowDone;
  let isShowNoActionNeeded;
  let isCardExpanded;
  if (run.status === RUN_STATUS.FAILED) {
    isShowDone = false;
    isShowNoActionNeeded = false;
    isCardExpanded = false;
  }
  else if (run.status === RUN_STATUS.RUNNING) {
    isShowDone = false;
    isShowNoActionNeeded = false;
    isCardExpanded = true;
  }
  else if (run.status === RUN_STATUS.COMPLETED) {
    const allActions = collectRunActions(run);
    const hasPending = allActions.some(action => action?.status === ACTION_STATUS.PENDING);
    const hasFailed = allActions.some(action => action?.status === ACTION_STATUS.FAILED);
    const hasSuggestion = runHasSuggestionAction(run);
    const noPending = !hasPending;
    isShowDone = noPending && !hasFailed && hasSuggestion;
    isShowNoActionNeeded = noPending && !hasFailed && !hasSuggestion;
    isCardExpanded = hasFailed || !noPending;
  }

  const [isExpanded, setIsExpanded] = useState(isCardExpanded);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);
  const [showThoughtProcessDialog, setShowThoughtProcessDialog] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const toggleDropdown = useCallback((e) => {
    if (showStatisticsDialog) return;
    if (e) e.stopPropagation();
    setDropdownOpen(prev => !prev);
  }, [showStatisticsDialog]);

  const handleShowStatistics = useCallback((e) => {
    e.stopPropagation();
    setShowStatisticsDialog(true);
    setDropdownOpen(false);
  }, []);

  const handleCloseStatistics = useCallback(() => {
    setShowStatisticsDialog(false);
  }, []);

  const handleShowThoughtProcess = useCallback((e) => {
    e.stopPropagation();
    setShowThoughtProcessDialog(true);
    setDropdownOpen(false);
  }, []);

  const handleCloseThoughtProcess = useCallback(() => {
    setShowThoughtProcessDialog(false);
  }, []);

  return (
    <div className={classnames('agent-run-card', { 'run-card-collapsed': !isExpanded })}>
      <div className="run-card-header" >
        <div className="run-card-header-left">
          <DateFormatter className="run-time" value={started_at} column={{ data: { format: FROM_NOW } }} />
          <span className="run-id">{gettext('Run')} #{id}</span>
          {eventTypes.map(type => (
            <span key={type} className="run-event-type-badge">{type}</span>
          ))}
          {isShowDone &&
            <span className="run-card-done">
              <Icon symbol="check-circle" className="mr-1" />
              {gettext('Done')}
            </span>
          }
          {isShowNoActionNeeded &&
            <span className="run-card-no-action-needed">
              {gettext('No action needed')}
            </span>
          }
        </div>
        <div className="run-card-header-right">
          {run.status === RUN_STATUS.RUNNING &&
            <span className="run-card-running mr-4">
              <Icon symbol="spinner" className="mr-1" />
              {gettext('Running')}
            </span>
          }
          {run.status === RUN_STATUS.FAILED &&
            <span className="run-card-failed mr-4">
              {gettext('Failed')}
            </span>
          }
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="run-card-more-dropdown">
            <DropdownToggle tag="span" className="run-card-more-toggle">
              <IconTooltip
                icon="more"
                tip={dropdownOpen ? null : gettext('More options')}
                className="seaqa-project-refresh-btn"
                placement="bottom"
                hoverBackground={true}
              />
            </DropdownToggle>
            <DropdownMenu end className="seaqa-dropdown-menu">
              <DropdownItem onClick={handleShowStatistics}>
                {gettext('Running log details')}
              </DropdownItem>
              {thoughtProcessEnabled && (
                <DropdownItem onClick={handleShowThoughtProcess}>
                  {gettext('Thought process')}
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
          <IconTooltip
            icon="arrow-down"
            tip={isExpanded ? gettext('Collapse') : gettext('Expand')}
            className={classnames('seaqa-project-refresh-btn m-0', { 'rotate-180': isExpanded })}
            placement="bottom"
            hoverBackground={true}
            onClick={toggleExpand}
          />
        </div>
      </div>

      {isExpanded ? (
        <div className="run-card-body">
          {items.map((item, index) => (
            <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
              <RunCardHeader item={item} />
              <div className="ticket-actions">
                {(item.actions || []).filter((action, actionIndex, arr) => {
                  if (action.type !== ACTION_TYPE.THOUGHT) return true;
                  const nextAction = arr[actionIndex + 1];
                  return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
                }).map((action, actionIndex) => (
                  <ActionItem
                    key={action.id || actionIndex}
                    action={action}
                    runId={id}
                    onConfirm={onConfirmAction}
                    onCancel={onCancelAction}
                    onViewContent={onViewContent}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Fallback: if no items but has top-level direct actions */}
          {items.length === 0 && actions.length > 0 && (
            <div className="run-actions-direct">
              {actions.filter((action, actionIndex, arr) => {
                if (action.type !== ACTION_TYPE.THOUGHT) return true;
                const nextAction = arr[actionIndex + 1];
                return !(nextAction && nextAction.type === ACTION_TYPE.SUMMARY);
              }).map((action, actionIndex) => (
                <ActionItem
                  key={action.id || actionIndex}
                  action={action}
                  runId={id}
                  onConfirm={onConfirmAction}
                  onCancel={onCancelAction}
                  onViewContent={onViewContent}
                />
              ))}
            </div>
          )}
        </div>
      )
        :
        <div className="run-card-body">
          {items.map((item, index) => (
            <div key={`${item.source_type}-${item.source_id}-${index}`} className="run-ticket-section">
              <RunCardHeader item={item} />
            </div>
          ))}
        </div>
      }
      {showStatisticsDialog && (
        <RunStatisticsDialog run={run} onToggle={handleCloseStatistics} />
      )}
      {showThoughtProcessDialog && (
        <ThoughtProcessDialog runId={id} onToggle={handleCloseThoughtProcess} />
      )}
    </div>
  );
};

export default RunCard;
