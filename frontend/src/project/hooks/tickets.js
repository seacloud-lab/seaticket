import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import deepCopy from 'deep-copy';
import { Ticket } from '../models';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import { toaster } from '../../components';
import User from '../../models/user';
import { isNumber } from '../../utils/type-detection';
import { BAR_TYPE, EVENT_BUS_TYPE, TICKET_PAGE_TYPE } from '../constants';
import eventBus from '../../utils/event-bus';

const INIT_METADATA = {
  rows: [],
  id_row_map: {},
};

const TicketsContext = React.createContext(null);

export const TicketsProvider = ({ projectUuid, projectName, children }) => {

  const [isLoading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState(INIT_METADATA);
  const [collaborators, setCollaborators] = useState([]);
  const [pageType, setPageType] = useState('');

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  // metadata api
  const getRowById = useCallback((rowID) => {
    if (!rowID) return null;
    return metadata.id_row_map[rowID];
  }, [metadata]);

  const applyCreateRows = useCallback((metadata, newRows = []) => {
    if (!Array.isArray(newRows) || newRows.length === 0) return;
    const newMetadata = metadata;
    newRows.forEach(row => {
      const newRow = row instanceof Ticket ? row : new Ticket(row);
      if (!newMetadata.id_row_map[newRow.id]) {
        newMetadata.id_row_map[newRow.id] = newRow;
        newMetadata.rows.push(newRow.id);
      } else {
        newMetadata.id_row_map[newRow.id] = newRow;
      }
    });
    setMetadata(deepCopy(newMetadata));
  }, []);

  const applyDeleteRows = useCallback((deletedRowIds = []) => {
    if (!Array.isArray(deletedRowIds) || deletedRowIds.length === 0) return;
    const newMetadata = metadata;
    deletedRowIds.forEach(rId => {
      if (newMetadata.id_row_map[rId]) {
        delete newMetadata.id_row_map[rId];
        const index = newMetadata.rows.findIndex(r => r.id === rId);
        newMetadata.rows.splice(index, 1);
      }
    });
    setMetadata(deepCopy(newMetadata));
  }, [metadata]);

  const applyModifyRow = useCallback((rowID, rowData) => {
    if (!rowID) return;
    const newMetadata = metadata;
    let row = newMetadata.id_row_map[rowID];
    row = row._update(rowData);
    newMetadata.id_row_map[rowID] = row;
    setMetadata(deepCopy(newMetadata));
  }, [metadata]);

  // ticket api
  const createTicket = useCallback((ticketData) => {
    return seaQAAPI.createProjectTicket(projectUuid, ticketData).then(res => {
      setLoading(true);
      const ticket = new Ticket(res.data.ticket);
      setPageType(ticket.id);
      applyCreateRows(INIT_METADATA, [ticket]);
      setLoading(false);
      return ticket;
    });
  }, []);

  const deleteTicket = useCallback((ticketID) => {
    return seaQAAPI.deleteProjectTicket(projectUuid, ticketID).then(res => {
      applyDeleteRows([ticketID]);
      return ticketID;
    });
  }, [applyDeleteRows]);

  const modifyTicket = useCallback((ticketID, ticketData) => {
    return seaQAAPI.modifyProjectTicket(projectUuid, ticketID, ticketData).then(res => {
      applyModifyRow(ticketID, ticketData);
      return ticketData;
    });
  }, [applyModifyRow]);

  // reply api
  const createReply = useCallback((ticketID, reply) => {
    return seaQAAPI.createProjectTicketReply(projectUuid, ticketID, reply).then(res => {
      const newMetadata = metadata;
      let row = newMetadata.id_row_map[ticketID];
      row = row._create_reply(res.data.ticket_reply);
      newMetadata.id_row_map[ticketID] = row;
      setMetadata(deepCopy(newMetadata));
      return res.data.ticket_reply;
    });
  }, [metadata]);

  const deleteReply = useCallback(() => {

  }, []);

  const modifyReply = useCallback(() => {

  }, []);

  const resetURL = useCallback((pageType) => {
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length + 1);
    const urlPart = pageType === TICKET_PAGE_TYPE.ALL || (!pageType && pageType !== 0) ? '/' : `/${pageType}/`;
    history.replaceState(null, null, origin + newPathname + BAR_TYPE.TICKET + urlPart);
  }, []);

  // load data
  const loadTicket = useCallback((ticketNumber) => {
    setLoading(true);
    seaQAAPI.getProjectTicket(projectUuid, ticketNumber).then(res => {
      const ticket = new Ticket(res.data.ticket);
      applyCreateRows(INIT_METADATA, [ticket]);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setMetadata(INIT_METADATA);
      setLoading(false);
    });
  }, [projectUuid]);

  const loadMoreTickets = useCallback((oldData) => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    seaQAAPI.listProjectTickets(projectUuid, pageRef.current, pageCountRef.current).then(res => {
      const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
      if (rows.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      applyCreateRows(oldData, rows);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, applyCreateRows]);

  const reLoadTickets = useCallback(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadMoreTickets(INIT_METADATA);
  }, [loadMoreTickets]);

  const reLoadData = useCallback((pageType) => {
    if (pageType === TICKET_PAGE_TYPE.NEW) {
      setMetadata(INIT_METADATA);
      setLoading(false);
      return;
    }
    if (pageType === TICKET_PAGE_TYPE.ALL) {
      reLoadTickets();
      return;
    }
    loadTicket(pageType);
  }, [reLoadTickets, loadTicket]);

  const togglePageType = useCallback((pageType) => {
    setLoading(true);
    setPageType(pageType);
    reLoadData(pageType);
  }, []);

  // load collaborators
  useEffect(() => {
    seaQAAPI.listProjectRelatedUsers(projectUuid).then(res => {
      const users = res.data?.related_users || [];
      setCollaborators(users.map(user => new User(user)));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid]);

  // init page type
  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const paramsString = decodePathname.slice(projectNameIndex + projectName.length + 1);
    const params = paramsString.split('/');
    const [, ticketType = ''] = params;
    let pageType = TICKET_PAGE_TYPE.ALL;
    if (ticketType === 'new') {
      pageType = TICKET_PAGE_TYPE.NEW;
    } else {
      const ticketNumber = Number(ticketType);
      pageType = ticketType && isNumber(ticketNumber) ? ticketNumber : TICKET_PAGE_TYPE.ALL;
    }
    setPageType(pageType);
    reLoadData(pageType);
  }, [projectName]);

  useEffect(() => {
    const allSubscribe = eventBus.subscribe(EVENT_BUS_TYPE.TICKET_PAGE, togglePageType);
    return () => {
      allSubscribe();
    };
  }, []);

  useEffect(() => {
    resetURL(pageType);
  }, [pageType]);

  return (
    <TicketsContext.Provider value={{
      isLoading,
      metadata,
      collaborators,
      pageType,
      getRowById,
      createTicket,
      deleteTicket,
      modifyTicket,
      createReply,
      deleteReply,
      modifyReply,
      loadTicket,
      reLoadTickets,
      loadMoreTickets,
      togglePageType,
    }}>
      {children}
    </TicketsContext.Provider>
  );
};

export const useTickets = () => {
  const context = useContext(TicketsContext);
  if (!context) {
    throw new Error('\'TicketsContext\' is null');
  }
  return context;
};
