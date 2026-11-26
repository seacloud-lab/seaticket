import React, { useContext, useEffect, useRef } from 'react';
import { EVENT_BUS_TYPE } from '@/project/constants';
import eventBus from '@/utils/event-bus';

export const LinkTicketContext = React.createContext(null);

// Subscribers match the resource currently displayed, so late responses cannot
// update another table or a different record after navigation.
export const useLinkedTicketUpdate = ({ projectUuid, tableName, rowId, onUpdate }) => {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  useEffect(() => eventBus.subscribe(EVENT_BUS_TYPE.TICKET_LINKED, (update) => {
    if (update.projectUuid !== projectUuid || update.tableName !== tableName) return;
    if (rowId != null && update.rowId !== String(rowId)) return;
    callbackRef.current(update);
  }), [projectUuid, tableName, rowId]);
};

export const useLinkTicket = () => {
  const context = useContext(LinkTicketContext);
  if (!context) {
    throw new Error('\'LinkTicketContext\' is null');
  }
  return context;
};
