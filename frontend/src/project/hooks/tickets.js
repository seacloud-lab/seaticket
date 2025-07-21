import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import deepCopy from 'deep-copy';
import { Ticket } from '../models';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import { toaster } from '../../components';
import User from '../../models/user';

const INIT_METADATA = {
  rows: [],
  id_row_map: {},
};

const TicketsContext = React.createContext(null);

export const TicketsProvider = ({ projectUuid, type, children }) => {

  const [isLoading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState(INIT_METADATA);
  const [collaborators, setCollaborators] = useState([]);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  // metadata api
  const createMetadataRows = useCallback((newRows = []) => {
    if (!Array.isArray(newRows) || newRows.length === 0) return;
    const newMetadata = deepCopy(metadata);
    newRows.forEach(r => {
      const newRow = new Ticket(r);
      if (!newMetadata.id_row_map[newRow.id]) {
        newMetadata.id_row_map[newRow.id] = newRow;
        newMetadata.rows.push(newRow);
      } else {
        const rowIndex = newMetadata.rows.findIndex(row => row.id === newRow.id);
        newMetadata.rows[rowIndex] = newRow;
        newMetadata.id_row_map[newRow.id] = newRow;
      }
    });
    setMetadata(newMetadata);
  }, [metadata]);

  // const deleteMetadataRows = useCallback((deletedRowIds = []) => {
  //   if (!Array.isArray(deletedRowIds) || deletedRowIds.length === 0) return;
  //   const newMetadata = deepCopy(metadata);
  //   deletedRowIds.forEach(rId => {
  //     if (newMetadata.id_row_map[rId]) {
  //       delete newMetadata.id_row_map[rId];
  //       const index = newMetadata.rows.findIndex(r => r.id === rId);
  //       newMetadata.rows.splice(index, 1);
  //     }
  //   });
  //   setMetadata(newMetadata);
  // }, [metadata]);

  // const modifyMetadataRows = useCallback((modifyRows = {}) => {
  //   if (Object.keys(modifyRows).length === 0) return;
  //   const newMetadata = deepCopy(metadata);
  //   Object.entries(modifyRows).forEach(modifyRow => {
  //     const [rId, rUpdate] = modifyRow;
  //     const row = newMetadata.rows.find(r => r.id === rId);
  //     row.update(rUpdate);
  //     newMetadata.id_row_map[rId] = row;
  //   }, []);
  //   setMetadata(newMetadata);
  // }, [metadata]);

  // ticket api
  const createTicket = useCallback((ticket) => {
  }, []);

  const deleteTickets = useCallback((ticketIds = []) => {

  }, []);

  const modifyTicket = useCallback((ticketData) => {

  }, []);

  // reply api
  const createReply = useCallback(() => {

  }, []);

  const deleteReply = useCallback(() => {

  }, []);

  const modifyReply = useCallback(() => {

  }, []);

  // load data
  const loadTicket = useCallback((ticketNumber) => {
    setLoading(true);
    seaQAAPI.getProjectTicket(projectUuid, ticketNumber).then(res => {
      const ticket = new Ticket(res.data.ticket);
      setMetadata({
        rows: [ticket],
        id_row_map: {
          [ticket.id]: ticket
        }
      });
      setLoading(false);
    }).catch(error => {
      setMetadata(INIT_METADATA);
      setLoading(false);
    });
  }, [projectUuid]);

  const loadMoreTickets = useCallback(() => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    seaQAAPI.listProjectTickets(projectUuid, pageRef.current, pageCountRef.current).then(res => {
      const rows = Array.isArray(res.data.tickets) ? res.data.tickets : [];
      if (rows.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      createMetadataRows(rows);
      setLoading(false);
    }).catch(error => {
      console.log(error);
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [isLoading, projectUuid, createMetadataRows]);

  const reLoadTickets = useCallback(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setMetadata(INIT_METADATA);
    loadMoreTickets();
  }, [loadMoreTickets]);

  useEffect(() => {
    if (type === 'new') {
      return;
    }
    if (type === 'all') {
      reLoadTickets();
      return;
    }
    loadTicket(type);
  }, [type]);

  useEffect(() => {
    seaQAAPI.listProjectRelatedUsers(projectUuid).then(res => {
      const users = res.data?.related_users || [];
      setCollaborators(users.map(user => new User(user)));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [projectUuid]);

  return (
    <TicketsContext.Provider value={{
      isLoading,
      metadata,
      collaborators,
      createTicket,
      deleteTickets,
      modifyTicket,
      createReply,
      deleteReply,
      modifyReply,
      loadTicket,
      reLoadTickets,
      loadMoreTickets,
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
