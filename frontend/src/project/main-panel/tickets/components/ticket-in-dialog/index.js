import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import deepCopy from 'deep-copy';
import { CenteredError, CenteredLoading } from '@/components';
import { DIALOG_SIZE, DIALOG_SIZE_VALUE, gettext, PERMISSION_TYPES, username } from '@/constants';
import { portalAPI } from '@/portal/api';
import { ticketsAPI } from '@/project/api';
import { EVENT_BUS_TYPE as GLOBAL_EVENT_BUS_TYPE } from '@/project/constants';
import { useLinkedTicketUpdate } from '@/project/hooks/link-ticket';
import { Issus as IssueModel } from '@/project/main-panel/portal-issues/models';
import eventBus from '@/utils/event-bus';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { TICKET_TABLE_NAME, TICKET_TYPE } from '../../constants';
import { Ticket as TicketModel } from '../../models';
import TicketDetails from '../ticket-details';

import './index.css';

const { isProjectAdmin } = window.app.pageOptions;

const TicketInDialog = forwardRef(({
  ticketID,
  projectUuid,
  permission,
  updateTicket,
  ticketType = TICKET_TYPE,
  isReadonly = false,
  isShowCustomer,
  getTicket = (projectUuid, ticketID) => ticketsAPI.getProjectTicket(projectUuid, ticketID),
}, ref) => {
  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [columns, setColumns] = useState([]);

  const [linkedRecords, setLinkedRecords] = useState({});

  const detailsRef = useRef(null);
  const requestIdRef = useRef(0);
  const resourceKey = useMemo(() => `${ticketType}_${ticketID}`, [ticketType, ticketID]);

  const modifyTicket = useCallback((projectUuid, currentTicketID, data) => {
    if (ticketType === TICKET_TYPE) return ticketsAPI.modifyProjectTicket(projectUuid, currentTicketID, data);
    return portalAPI.modifyPortalIssue(projectUuid, currentTicketID, data);
  }, [ticketType]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMessage(null);
    setTicket(null);
    setLinkedRecords({});
    setColumns([]);
    getTicket(projectUuid, ticketID).then(res => {
      if (requestId !== requestIdRef.current) return;
      const ticket = ticketType === TICKET_TYPE ? new TicketModel(res.data.ticket) : new IssueModel(res.data.issue);
      setColumns(res.data.columns || []);
      const linkedRecords = ticketType === TICKET_TYPE
        ? res.data?.linked_records_info
        : ticket.linked_ticket ? { [ticket.linked_ticket]: { title: res.data?.linked_ticket_title || '' } } : {};
      // Preserve local updates received while the details request was in flight.
      setTicket(current => {
        if (!current) return ticket;
        const update = { ...current };
        if (Array.isArray(current.linked_connection_records)) {
          update.linked_connection_records = Array.from(new Set([...ticket.linked_connection_records, ...current.linked_connection_records]));
        }
        return deepCopy(ticket._update(update));
      });
      setLinkedRecords(current => ({ ...(linkedRecords || {}), ...current }));
    }).catch(error => {
      if (requestId !== requestIdRef.current) return;
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    });

    return () => {
      requestIdRef.current = requestId + 1;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid, ticketID, ticketType]);

  useEffect(() => {
    updateTicket(isLoading ? null : ticket, { columns });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, columns, isLoading]);

  const applyTicketUpdate = useCallback((ticketUpdate, linkedRecords = {}) => {
    setTicket(current => {
      const update = isFunction(ticketUpdate) ? ticketUpdate(current) : ticketUpdate;
      return current?._update ? deepCopy(current._update(update)) : { ...current, ...update };
    });
    setLinkedRecords(cur => ({ ...cur, ...linkedRecords }));
  }, []);

  useLinkedTicketUpdate({ projectUuid, tableName: TICKET_TABLE_NAME, rowId: ticketID, onUpdate: ({ updateTicket, linkedRecordsInfo }) => {
    if (ticketType === TICKET_TYPE) applyTicketUpdate(updateTicket, linkedRecordsInfo);
  } });

  useEffect(() => {
    const localChanged = (key, ticketUpdate, linkedRecords = {}) => {
      if (key !== resourceKey) return;
      applyTicketUpdate(ticketUpdate, linkedRecords);
    };

    const unsubscribeLocalChanged = eventBus.subscribe(GLOBAL_EVENT_BUS_TYPE.MODIFY_LOCAL_RECORD_IN_DIALOG, localChanged);
    return () => {
      unsubscribeLocalChanged();
    };
  }, [resourceKey, applyTicketUpdate]);

  useImperativeHandle(ref, () => ({
    setActivities: (...args) => detailsRef.current?.setActivities(...args),
    onChange: (...args) => detailsRef.current?.onChange(...args),
  }), []);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);
  if (!ticket) return (<CenteredError>{ticketType === TICKET_TYPE ? gettext('Ticket not found') : gettext('Issue not found')}</CenteredError>);

  const canModifyTicket = !isReadonly && (ticket.creator === username || permission === PERMISSION_TYPES.READ_WRITE);

  return (
    <div className="seaqa-project-ticket seaqa-project-ticket-in-dialog">
      <TicketDetails
        ref={detailsRef}
        smallScreenSize={DIALOG_SIZE_VALUE[DIALOG_SIZE.S]}
        ticketType={ticketType}
        permission={isReadonly ? PERMISSION_TYPES.READ_ONLY : permission}
        isAdmin={isReadonly ? false : isProjectAdmin}
        projectUuid={projectUuid}
        ticket={ticket}
        isShowCustomer={isShowCustomer}
        setTicket={setTicket}
        modifyTicket={canModifyTicket ? modifyTicket : undefined}
        linkedRecords={linkedRecords}
        setLinkedRecords={setLinkedRecords}
      />
    </div>
  );
});

export default TicketInDialog;
