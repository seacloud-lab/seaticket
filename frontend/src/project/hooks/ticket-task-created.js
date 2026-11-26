import { useEffect, useRef } from 'react';
import { EVENT_BUS_TYPE } from '@/project/constants';
import eventBus from '@/utils/event-bus';

export const useTicketTaskCreated = ({ projectUuid, rowId, onUpdate }) => {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  useEffect(() => eventBus.subscribe(EVENT_BUS_TYPE.TICKET_TASK_CREATED, update => {
    if (update.projectUuid !== projectUuid) return;
    if (rowId != null && update.rowId !== String(rowId)) return;
    callbackRef.current(update);
  }), [projectUuid, rowId]);
};
