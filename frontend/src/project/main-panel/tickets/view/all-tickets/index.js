import React, { useMemo } from 'react';
import { ticketsAPI } from '../../../../api';
import Tickets from '../../components/tickets';
import { useTicketsPage } from '../../hooks';

const AllTickets = ({ projectUuid, workspaceID, projectName, permission, toggleBar }) => {
  const { viewID } = useTicketsPage();

  const api = useMemo(() => ({
    getMetadata: (...params) => ticketsAPI.listProjectTickets(projectUuid, ...params),
    getViews: () => ticketsAPI.listViews(projectUuid),
    getView: (viewID) => ticketsAPI.getView(projectUuid, viewID),
    insertView: (name, viewData) => ticketsAPI.insertView(projectUuid, name, viewData),
    modifyView: (viewID, viewData) => ticketsAPI.modifyView(projectUuid, viewID, viewData),
    deleteView: (viewID) => ticketsAPI.deleteView(projectUuid, viewID),
    moveView: (sourceViewID, targetViewID) => ticketsAPI.moveView(projectUuid, sourceViewID, targetViewID),
    duplicateView: (viewID) => ticketsAPI.duplicateView(projectUuid, viewID),
    // row
    modifyRow: (...params) => ticketsAPI.modifyProjectTicket(projectUuid, ...params),
    modifyRows: (...params) => ticketsAPI.modifyProjectTickets(projectUuid, ...params),
    deleteRow: (...params) => ticketsAPI.deleteProjectTicket(projectUuid, ...params),
    deleteRows: (...params) => ticketsAPI.deleteProjectTickets(projectUuid, ...params),
  }), [projectUuid]);

  return (
    <Tickets
      projectUuid={projectUuid}
      workspaceID={workspaceID}
      projectName={projectName}
      permission={permission}
      viewID={viewID}
      toggleBar={toggleBar}
      api={api}
    />
  );
};

export default AllTickets;
