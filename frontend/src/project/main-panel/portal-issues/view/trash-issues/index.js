import React, { useCallback, useMemo } from 'react';
import { portalAPI } from '@/portal/api';
import { VIEW_TOOL } from '@/sea-metadata';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import context from '@/sea-metadata/context';
import CleanPortalIssues from './clean-portal-issues';
import Issues from '../../components/issues';
import { useData } from '@/project/hooks';
import { PORTAL_ISSUE_TABLE_NAME } from '../../constants';
import { usePortalIssuesPage } from '../../hooks';

const viewTools = [VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS, VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS];

const TrashPortalIssues = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {
  const { clearViewRows, restoreRows } = useData();
  const { isLoading, togglePageSlugId } = usePortalIssuesPage();

  const viewsData = useMemo(() => ({
    navigation: [{ _id: 'trash', type: 'view' }],
    views: [
      {
        _id: 'trash',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => portalAPI.listPortalIssuesTrash(projectUuid, ...params),

    getViews: () => new Promise((resolve, reject) => resolve({ data: viewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];
        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
          groupbys: context.localStorage.getItem('groupbys') || [],
        } } });
      });
    },
    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),
  }), [projectUuid, viewsData]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-deleted-portal-issues`, [projectUuid]);

  const handleRestorePortalIssues = useCallback((issueIds, { deleteLocalRows, selectNone }) => {
    portalAPI.restorePortalIssues(projectUuid, issueIds).then(res => {
      deleteLocalRows(issueIds);
      selectNone && selectNone();
      toaster.success(gettext('Portal issues restored'));
      restoreRows(PORTAL_ISSUE_TABLE_NAME, issueIds);
    }).catch(error => {
      toaster.danger(gettext('Failed to restore portal issues'));
    });
  }, [projectUuid, restoreRows]);

  const createRowsTools = useCallback(({ rows, deleteLocalRows, selectNone }) => {
    let tools = [];
    tools.push({
      key: 'restore',
      icon: 'revoke',
      label: gettext('Restore'),
      callback: (event) => {
        event && event.stopPropagation();
        event?.nativeEvent && event.nativeEvent.stopImmediatePropagation();
        const rowIds = rows.map(r => r._id);
        handleRestorePortalIssues(rowIds, { deleteLocalRows, selectNone });
      },
    });
    return tools;
  }, [workspaceID, projectName, handleRestorePortalIssues]);

  const createContextMenuOptions = useCallback(({
    isGroupView,
    selectedRange,
    selectedPosition,
    position,
    table,
    rowMetrics,
    deleteRow,
    deleteLocalRows,
    hideMenu,
    onClearSelected,
    onCopySelected,
    rowGetterByIndex,
    selectNone,
    context,
  }) => {

    let list = [];

    // handle selected multiple cells
    if (selectedRange) {
      list.push({
        label: gettext('Copy selected'),
        key: 'copy_selected',
        callback: onCopySelected,
      });
      return list;
    }

    // handle selected rows
    const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
    if (selectedRowIds.length > 1) {
      let rows = [];
      selectedRowIds.forEach(id => {
        const row = table.id_row_map[id];
        if (row) {
          rows.push(row);
        }
      });

      if (rows.length > 0) {
        list.push({
          label: gettext('Restore'),
          key: 'restore',
          callback: (event) => {
            const rowIds = rows.map(row => row._id);
            handleRestorePortalIssues(rowIds, { deleteLocalRows, selectNone });
          }
        });
      }
      return list;
    }

    // handle selected cell
    if (!selectedPosition) return list;
    const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
    const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
    if (!row) return list;

    if (selectedRowIds.length === 1) {
      list.push({
        label: gettext('Restore'),
        key: 'restore',
        callback: () => handleRestorePortalIssues([row._id], { deleteLocalRows, selectNone }),
      });
    }
    return list;
  }, [projectName, workspaceID, handleRestorePortalIssues]);

  const cleanPortalIssues = useCallback(() => {
    clearViewRows(PORTAL_ISSUE_TABLE_NAME, 'trash', () => portalAPI.cleanPortalIssuesTrash(projectUuid), true).then(() => {
      context.eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.CLEAR_DATA);
      toaster.success(gettext('The portal issue trash cleaned'));
    }).catch(() => {
      toaster.danger(gettext('Failed to clean the portal issue trash'));
    });
  }, [projectUuid, clearViewRows]);

  return (
    <>
      <Issues
        localStorageNamePrefix={localStorageNamePrefix}
        projectUuid={projectUuid}
        workspaceID={workspaceID}
        projectName={projectName}
        permission={permission}
        isShowViewInURL={false}
        toggleBar={toggleBar}
        api={api}
        settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false, canClearCells: false, canPasteCells: false, canDragFillCells: false }}
        viewTools={viewTools}
        createRowsTools={createRowsTools}
        createContextMenuOptions={createContextMenuOptions}
        isBuiltInView={true}
        isLoading={isLoading}
        togglePageSlugId={togglePageSlugId}
      />
      <CleanPortalIssues cleanPortalIssues={cleanPortalIssues} />
    </>
  );
};

export default TrashPortalIssues;
