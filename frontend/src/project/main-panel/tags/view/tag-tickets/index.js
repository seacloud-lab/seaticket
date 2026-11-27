import React, { useMemo } from 'react';
import { CenteredLoading } from '@/components';
import { gettext } from '@/constants';
import { useTags } from '@/project/hooks';
import { VIEW_TOOL, useMetadataController } from '@/sea-metadata';
import { getRowById } from '@/sea-metadata/utils/row';
import { ticketsAPI } from '../../../../api';
import Tickets from '../../../tickets/components/tickets';
import { TICKET_CHILDREN_PAGE_SLUG_ID } from '../../../tickets/constants';
import { useTicketsPage } from '../../../tickets/hooks';

const TagTickets = ({ projectUuid, workspaceID, projectName, toggleBar }) => {
  const controller = useMetadataController();

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId, toggleView } = useTicketsPage();
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
          sorts: controller.storage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve, reject) => {
        Object.keys(viewData).forEach(key => {
          controller.storage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId, controller]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-tag-tickets`, [projectUuid]);

  if (isLoading || isTagsLoading) return (<CenteredLoading />);
  const tag = getRowById(tagsData, childrenPageSlugId);
  if (!tag) {
    togglePageSlugId(pageSlugId, TICKET_CHILDREN_PAGE_SLUG_ID.ALL);
    return null;
  }

  return (
    <Tickets
      controller={controller}
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
      toggleView={toggleView}
      isLoading={isLoading}
      togglePageSlugId={togglePageSlugId}
    />
  );
};

export default TagTickets;
