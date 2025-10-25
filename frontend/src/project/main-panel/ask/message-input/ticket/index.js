import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { Icon, SyncOptionsEditor } from '@/components';
import { gettext } from '@/constants';
import { ticketsAPI } from '@/project/api';
import { TicketForAI } from '@/project/main-panel/tickets/models';

const Ticket = ({ projectUuid, value: ticket = null, onChange: propsOnChange }) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const ref = useRef();
  const ticketsRef = useRef([]);

  const openSelector = useCallback(() => {
    setIsShowSelector(true);
  }, []);

  const onSearch = useCallback((value, signal) => {
    return ticketsAPI.listProjectTicketsBySearch(projectUuid, value, signal).then(res => {
      const tickets = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForAI(t)) : [];
      ticketsRef.current = tickets;
      return tickets.map(t => ({
        value: t._id,
        label: (
          <span className="text-truncate" title={t.title}>
            {t.title}
          </span>
        ),
      }));
    });
  }, [projectUuid]);

  const onChange = useCallback((ticketId) => {
    const ticket = ticketsRef.current.find(t => t._id === ticketId) || null;
    propsOnChange && propsOnChange(ticket);
  }, [propsOnChange]);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  return (
    <>
      <div
        className={classnames('sea-qa-select custom-select sea-qa-customize-select', 'sea-qa-ai-chat-tool-select sea-qa-ai-chat-ticket-select', { 'highlighted': ticket })}
        ref={ref}
        onClick={openSelector}
      >
        <div className="selected-option">
          <div className="selected-option-show">{ticket ? ticket.title : gettext('Ticket')}</div>
          <Icon symbol="down" />
        </div>
      </div>
      {isShowSelector && (
        <SyncOptionsEditor
          className="sea-qa-ai-chat-tool-select-editor"
          target={ref}
          placeholder={gettext('Search ticket')}
          emptyTip={gettext('No tickets')}
          value={ticket?._id}
          onChange={onChange}
          onToggle={onToggle}
          onSearch={onSearch}
        />
      )}
    </>
  );

};

export default Ticket;
