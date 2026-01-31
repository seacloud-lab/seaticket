import React, { useMemo } from 'react';
import { ticketsAPI } from '../../../../api';
import { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useTicketsPage } from '../../../tickets/hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID } from '../../../tickets/constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import Tickets from '../../../tickets/components/tickets';
import { useTags } from '@/project/hooks';

const TagTickets = ({ projectUuid, workspaceID, projectName, toggleBar }) => {

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId } = useTicketsPage();
  const { isLoading: isTagsLoading, tagsData } = useTags();

  const viewsData = useMemo(() => ({
    navigation: [{ _id: '0000', type: 'view' }],
    views: [
      {
        _id: '0000',
        name: gettext('All'),
      }
    ]
  }), []);

  const api = useMemo(() => ({
    getMetadata: (...params) => ticketsAPI.listTicketsByTag(projectUuid, childrenPageSlugId),

    // view
    getViews: () => {
      return new Promise((resolve, reject) => {
        resolve({ data: viewsData });
      });
    },

    getView: (viewID) => {
      return new Promise((resolve, reject) => {
        const view = viewsData.views[0];

        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId]);

  const localStorageNamePrefix = useMemo(() => `sea-qa-${projectUuid}-tag-tickets`, [projectUuid]);

  if (isLoading || isTagsLoading) return (<CenteredLoading />);
  const tag = getRowById(tagsData, childrenPageSlugId);
  if (!tag) {
    togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
    return null;
  }

  return (
    <Tickets
      projectUuid={projectUuid}
      workspaceID={workspaceID}
      projectName={projectName}
      toggleBar={toggleBar}
      api={api}
      viewID=''
      canFindRelatedIssues={false}
      viewTools={[VIEW_TOOL.SEARCH, VIEW_TOOL.SORTS]}
      settings={{ isFilterComputedOnServer: false, isSortComputedOnServer: false, canManageView: false }}
      localStorageNamePrefix={localStorageNamePrefix}
    />
  );
};

export default TagTickets;
