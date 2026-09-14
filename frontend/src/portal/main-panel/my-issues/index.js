import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, CenteredLoading } from '@/components';
import { server, gettext, PERMISSION_TYPES } from '@/constants';
import Issues from '@/project/main-panel/portal-issues/components/issues';
import Issue from '@/project/main-panel/portal-issues/view/issue';
import TopBar from '@/project/main-panel/top-bar';
import { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { default as LongTextEditorUtilities } from '@/utils/long-text';
import { portalAPI } from '../../api';
import { PORTAL_PAGE } from '../../constants';
import { buildPortalPath, getPortalPathSegments } from '../../path-utils';
import MobileIssueCards from './mobile-issue-cards';
import { PORTAL_ISSUE_TABLE_NAME } from '@/project/main-panel/portal-issues/constants';

import './index.css';

const viewTools = [
  VIEW_TOOL.ROWS_TOOLS, VIEW_TOOL.VIEWS,
  VIEW_TOOL.SEARCH, VIEW_TOOL.FILTERS, VIEW_TOOL.SORTS, VIEW_TOOL.GROUPBYS, VIEW_TOOL.ROW_COLOR, VIEW_TOOL.ROW_HEIGHT, VIEW_TOOL.ORDER_HIDDEN,
];

const MyIssues = ({ isEditMode, projectUuid, projectName, workspaceID, isTeam = false }) => {
  const [expandIssueID, setExpandIssueId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const canEditAllIssues = !window.app.pageOptions.isExternalUser && !window.app.pageOptions.isPreviewUser;

  const listQueryStringRef = useRef('');

  const myIssueViewsData = useMemo(() => ({
    navigation: [
      { _id: 'open', type: 'view' },
      { _id: 'closed', type: 'view' },
    ],
    views: [
      {
        _id: 'open',
        name: 'Open',
      }, {
        _id: 'closed',
        name: 'Closed',
      },
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => {
      const sorts = context.localStorage.getItem('sorts') || [];
      const filters = context.localStorage.getItem('filters') || [];
      const filter_conjunction = context.localStorage.getItem('filter_conjunction') || 'And';
      const basic_filters = context.localStorage.getItem('basic_filters') || [];
      const listIssues = isTeam ? portalAPI.listTeamIssues.bind(portalAPI) : portalAPI.listMyIssues.bind(portalAPI);
      const requestParams = {
        ...params[0],
        filters,
        filter_conjunction,
        basic_filters,
        sorts,
      };
      return listIssues(projectUuid, requestParams);
    },

    getViews: () => new Promise((resolve, reject) => resolve({ data: myIssueViewsData })),

    // view
    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = myIssueViewsData.views.find(v => v._id === viewID) || myIssueViewsData.views[0];
        resolve({
          data: {
            view: {
              ...view,
              sorts: context.localStorage.getItem('sorts') || [],
              groupbys: context.localStorage.getItem('groupbys') || [],
              filters: context.localStorage.getItem('filters') || [],
              filter_conjunction: context.localStorage.getItem('filter_conjunction') || 'And',
              basic_filters: context.localStorage.getItem('basic_filters') || [],
              colorbys: context.localStorage.getItem('colorbys') || {},
              row_height: context.localStorage.getItem('row_height') || '',
              hidden_columns: context.localStorage.getItem('hidden_columns') || [],
              columns_keys: context.localStorage.getItem('columns_keys') || [],
            }
          }
        });
      });
    },
    modifyView: (viewID, viewData) => new Promise((resolve, reject) => {
      Object.keys(viewData).forEach(key => {
        context.localStorage.setItem(key, viewData[key]);
      });
      resolve({ data: { success: true } });
    }),

    // file
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params),
  }), [projectUuid, myIssueViewsData, isTeam]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-${isTeam ? 'team-issues' : 'my-issues'}`, [projectUuid, isTeam]);

  const longTextAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (...params) => portalAPI.uploadFile(projectUuid, ...params)
  } }), [projectUuid]);

  const dataDidMount = useCallback((data) => {
    if (data.view.basic_filters.length !== 2) {
      data.view.basic_filters = [
        { column_key: context.getSetting('typeColumnKey'), filter_predicate: 'is_any_of', filter_term: [] },
        { column_key: context.getSetting('tagsColumnKey'), filter_predicate: 'has_any_of', filter_term: [] },
      ];
    }
  }, []);

  const openIssue = useCallback((issueID) => {
    const { search } = window.location;
    listQueryStringRef.current = new URLSearchParams(search).toString();
    const page = isTeam ? PORTAL_PAGE.TEAM_ISSUES : PORTAL_PAGE.MY_ISSUES;
    const url = buildPortalPath(page, issueID);
    history.replaceState(null, null, url);
    setExpandIssueId(issueID);
  }, [isTeam]);

  const closeIssue = useCallback(() => {
    const queryString = listQueryStringRef.current;
    const page = isTeam ? PORTAL_PAGE.TEAM_ISSUES : PORTAL_PAGE.MY_ISSUES;
    const url = buildPortalPath(page) + (queryString ? `?${queryString}` : '');
    history.replaceState(null, null, url);
    listQueryStringRef.current = '';
    setExpandIssueId(null);
  }, [isTeam]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const pathSegments = getPortalPathSegments();
    if (pathSegments.length <= 1) {
      setIsLoading(false);
      return;
    }
    const [, issueID] = pathSegments;
    openIssue(issueID);
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return (<CenteredLoading />);

  if (expandIssueID) {
    return (
      <>
        {!isMobile && (
          <TopBar className="seaqa-portal-issue-header" >
            <>
              <IconButton
                icon="arrow-down"
                className="rotate-icon-90 seaqa-portal-toggle-knowledge-btn"
                onClick={closeIssue}
              />
              <span className="text-truncate" title={isTeam ? gettext('Team issues') : gettext('My issues')}>
                {isTeam ? gettext('Team issues') : gettext('My issues')}
              </span>
            </>
          </TopBar>
        )}
        <Issue
          editorAPI={longTextAPI}
          projectUuid={projectUuid}
          issueID={expandIssueID}
          permission={PERMISSION_TYPES.READ_WRITE}
          isAdmin={false}
          canEditAllIssues={canEditAllIssues}
          projectName={projectName}
          workspaceID={workspaceID}
          togglePageSlugId={closeIssue}
          generatorIssuesContextMenuOptions={() => []}
          isMobile={isMobile}
        />
      </>
    );
  }

  return (
    <Issues
      key={isMobile ? 'mobile-card-view' : 'desktop-table-view'}
      projectUuid={projectUuid}
      workspaceID={workspaceID}
      projectName={projectName}
      permission={PERMISSION_TYPES.READ_WRITE}
      api={api}
      metadataCacheTableName={`${PORTAL_ISSUE_TABLE_NAME}-${isTeam ? 'team' : 'my'}`}
      forceReload={true}
      localStorageNamePrefix={localStorageNamePrefix}
      settings={{ isFilterComputedOnServer: true, isSortComputedOnServer: true, canManageView: false }}
      dataDidMount={dataDidMount}
      viewTools={viewTools}
      canCreateRelatedTickets={false}
      isBuiltInView={true}
      canOpenIssue={false}
      createContextMenuOptions={() => []}
      togglePageSlugId={openIssue}
      CustomView={isMobile ? MobileIssueCards : null}
      onCustomViewRowClick={openIssue}
      isMobileView={isMobile}
    />
  );
};

export default MyIssues;
