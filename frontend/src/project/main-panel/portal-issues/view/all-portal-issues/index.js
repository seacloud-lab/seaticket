import React, { useCallback, useMemo, useState } from 'react';
import { portalAPI } from '@/portal/api';
import { PORTAL_ISSUE_STATUS, PORTAL_ISSUE_TYPE, PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG } from '../../constants';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import { usePortalIssuesPage, useMetadata } from '../../hooks';
import Tickets from '@/project/main-panel/tickets/components/tickets';
import CreateTicketDialog from '../../components/create-ticket-dialog';

import './index.css';

const AllPortalIssues = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {
  const { viewID, toggleView, isLoading, togglePageSlugId, onRefresh } = usePortalIssuesPage();
  const metadata = useMetadata();
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);

  const api = useMemo(() => ({
    getMetadata: (...params) => portalAPI.listIssues(projectUuid, ...params).then((res) => {
      const columns = Array.isArray(res?.data?.columns) ? res.data.columns : [];
      const issues = Array.isArray(res?.data?.issues) ? res.data.issues : [];
      const normalizedIssues = issues.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const nextRow = { ...row, _id: row._pk };
        columns.forEach((column) => {
          const columnName = column?.name;
          const columnKey = column?.key;
          if (!columnName || !columnKey || columnName === columnKey) return;
          if (nextRow[columnName] !== undefined && nextRow[columnKey] === undefined) {
            nextRow[columnKey] = nextRow[columnName];
          }
        });
        return nextRow;
      });

      // Apply portal issue predefined column config (e.g. linked_ticket as CellType.LINK)
      const normalizedColumns = columns.map(c => {
        const config = PORTAL_ISSUE_PREDEFINED_COLUMN_CONFIG[c.name];
        return config ? { ...c, ...config } : c;
      });

      return {
        ...res,
        data: {
          ...res.data,
          tickets: normalizedIssues,
          columns: normalizedColumns,
          linked_record_titles: res.data?.ticket_pk_to_ticket_title || {},
        },
      };
    }),
    getViews: () => portalAPI.listPortalIssuesViews(projectUuid),
    getView: (targetViewID) => portalAPI.getPortalIssuesView(projectUuid, targetViewID),
    insertView: (name, viewData) => portalAPI.insertPortalIssuesView(projectUuid, name, viewData),
    modifyView: (targetViewID, viewData) => portalAPI.modifyPortalIssuesView(projectUuid, targetViewID, viewData),
    deleteView: (targetViewID) => portalAPI.deletePortalIssuesView(projectUuid, targetViewID),
    moveView: (sourceViewID, targetViewID) => portalAPI.movePortalIssuesView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (targetViewID) => portalAPI.duplicatePortalIssuesView(projectUuid, targetViewID),
    modifyRow: (issueNumber, update) => portalAPI.updatePortalIssue(projectUuid, issueNumber, update),
    deleteRow: (issueNumber) => portalAPI.deletePortalIssue(projectUuid, issueNumber),
    deleteRows: (issueIds) => portalAPI.deletePortalIssues(projectUuid, issueIds),
  }), [projectUuid]);

  const handleCreateRelatedTicket = useCallback((row) => {
    if (!row) return;
    setCurrentRow(row);
    setIsCreateTicketDialogOpen(true);
  }, []);

  const createRowsTools = useCallback((props) => {
    const { rows } = props;
    const tools = [];

    // Only show tools when a single row is selected
    if (rows.length !== 1) {
      return tools;
    }

    const row = rows[0];

    // Create related ticket action
    if (!row?.linked_ticket) {
      tools.push({
        key: 'create-related-ticket',
        label: gettext('Create related ticket'),
        icon: 'ticket',
        callback: () => handleCreateRelatedTicket(row),
      });
    }

    // Close issue action
    if (row?.state === PORTAL_ISSUE_STATUS.OPEN) {
      tools.push({
        key: 'close-issue',
        label: gettext('Close issue'),
        icon: 'check-circle-stroked',
        callback: () => {
          portalAPI.updatePortalIssue(projectUuid, row._pk, { state: PORTAL_ISSUE_STATUS.CLOSED }).then(() => {
            toaster.success(gettext('Issue closed'));
            context.eventBus.dispatch('reload_data');
          }).catch(() => {
            toaster.danger(gettext('Failed to close issue'));
          });
        }
      });
    }

    return tools;
  }, [projectUuid, handleCreateRelatedTicket]);

  const createContextMenuOptions = useCallback((props) => {
    const { isGroupView, selectedPosition, rowGetterByIndex, table, rowMetrics } = props;
    const list = [];

    // handle selected cell
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;

    if (!row?.linked_ticket) {
      list.push({
        label: gettext('Create related ticket'),
        key: 'create-related-ticket',
        callback: () => handleCreateRelatedTicket(row),
      });
    }

    return list;
  }, [handleCreateRelatedTicket]);

  return (
    <>
      <Tickets
        projectUuid={projectUuid}
        workspaceID={workspaceID}
        projectName={projectName}
        permission={permission}
        viewID={viewID}
        toggleBar={toggleBar}
        api={api}
        canFindRelatedIssues={false}
        isLoading={isLoading}
        toggleView={toggleView}
        togglePageSlugId={togglePageSlugId}
        onRefresh={onRefresh}
        getTicket={(uuid, issueNumber) => portalAPI.getPortalIssue(uuid, issueNumber)}
        localStorageNamePrefix={`sea-qa-${projectUuid}-portal-issues`}
        createContextMenuOptions={createContextMenuOptions}
        createRowsTools={createRowsTools}
        settings={{ canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        tableName="portal_issues"
        rowType={PORTAL_ISSUE_TYPE}
        metadata={metadata}
      />
      {isCreateTicketDialogOpen && currentRow && (
        <CreateTicketDialog
          projectUuid={projectUuid}
          row={currentRow}
          onClose={() => {
            setIsCreateTicketDialogOpen(false);
            setCurrentRow(null);
          }}
        />
      )}
    </>
  );
};

export default AllPortalIssues;
