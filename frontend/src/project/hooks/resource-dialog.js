import { createContext, useEffect, useRef } from 'react';
import { EVENT_BUS_TYPE } from '@/project/constants';
import eventBus from '@/utils/event-bus';

export const ResourceDialogContext = createContext({});

export const useResourceUpdate = ({ projectUuid, tableName, rowId, onUpdate }) => {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  useEffect(() => eventBus.subscribe(EVENT_BUS_TYPE.RESOURCE_UPDATED, update => {
    if (update.projectUuid !== projectUuid || update.tableName !== tableName) return;
    if (rowId != null && update.rowId !== String(rowId)) return;
    callbackRef.current(update);
  }), [projectUuid, tableName, rowId]);
};
