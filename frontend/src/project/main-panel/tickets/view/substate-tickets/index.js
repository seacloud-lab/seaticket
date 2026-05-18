import React, { useMemo } from 'react';
import { ticketsAPI } from '../../../../api';
import { VIEW_TOOL } from '@/sea-metadata';
import context from '@/sea-metadata/context';
import { useTicketsPage, useMetadata } from '../../hooks';
import { TICKET_CHILDREN_PAGE_SLUG_ID } from '../../constants';
import { gettext } from '@/constants';
import { CenteredLoading } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import Tickets from '../../components/tickets';

const SubstateTickets = ({ projectUuid, workspaceID, projectName, toggleBar }) => {

  const { isLoading, pageSlugId, childrenPageSlugId, togglePageSlugId, toggleView } = useTicketsPage();
  const { substatesData } = useMetadata();

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
    getMetadata: (...params) => ticketsAPI.listTicketsBySubstate(projectUuid, childrenPageSlugId),

    // view
    getViews: () => new Promise((resolve) => resolve({ data: viewsData })),

    getView: (viewID) => {
      return new Promise((resolve) => {
        const view = viewsData.views[0];
        resolve({ data: { view: {
          ...view,
          sorts: context.localStorage.getItem('sorts') || [],
        } } });
      });
    },

    modifyView: (viewID, viewData) => {
      return new Promise((resolve) => {
        Object.keys(viewData).forEach(key => {
          context.localStorage.setItem(key, viewData[key]);
        });
        resolve({ data: { success: true } });
      });
    },
  }), [projectUuid, childrenPageSlugId, viewsData, togglePageSlugId]);

  const localStorageNamePrefix = useMemo(() => `seaqa-${projectUuid}-substate-tickets`, [projectUuid]);

  if (isLoading) return (<CenteredLoading />);

  const substate = getRowById(substatesData, childrenPageSlugId);
  if (!substate) {
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
      toggleView={toggleView}
      isLoading={isLoading}
      togglePageSlugId={togglePageSlugId}
    />
  );
};

export default SubstateTickets;
