import React, { useCallback, useRef, useState } from 'react';
import classnames from 'classnames';
import { Icon, SyncOptionsEditor } from '@/components';
import { gettext } from '@/constants';
import { ticketsAPI } from '@/project/api';
import { TicketForAI } from '@/project/main-panel/tickets/models';

import './index.css';

const AddTickets = ({ projectUuid, value: tickets = [], onChange: propsOnChange }) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const ref = useRef();
  const ticketsRef = useRef([]);

  const openSelector = useCallback(() => {
    setIsShowSelector(true);
  }, []);

  const onSearch = useCallback((value, signal) => {
    return ticketsAPI.listProjectTicketsBySearch(projectUuid, value, signal).then(res => {
      const newTickets = Array.isArray(res.data.tickets) ? res.data.tickets.map(t => new TicketForAI(t)) : [];
      ticketsRef.current = [...tickets, ...newTickets];
      return newTickets.map(t => ({
        value: t._id,
        label: (
          <div className="sea-qa-ai-chat-tool-select-ticket-item">
            <Icon symbol="all-tickets" className="mr-2" />
            <span className="text-truncate" title={t.title}>
              {t.title}
            </span>
          </div>

        ),
      }));
    });
  }, [projectUuid, tickets]);

  const onChange = useCallback((newTicketIds) => {
    const newTickets = newTicketIds.map(tid => ticketsRef.current.find(t => t._id === tid));
    propsOnChange && propsOnChange(newTickets);
  }, [propsOnChange]);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  return (
    <>
      <div
        className={classnames('sea-qa-select custom-select sea-qa-customize-select', 'sea-qa-ai-chat-tool-select sea-qa-ai-chat-ticket-select')}
        ref={ref}
        onClick={openSelector}
      >
        <div className="selected-option">
          <Icon symbol="add" />
          <div className="selected-option-show">{gettext('Add ticket')}</div>
        </div>
      </div>
      {isShowSelector && (
        <SyncOptionsEditor
          className="sea-qa-ai-chat-tool-type-select-editor sea-qa-ai-chat-tool-ai-model-select-editor"
          target={ref}
          isMultiple={true}
          checkPlacement="left"
          placeholder={gettext('Search ticket')}
          emptyTip={gettext('No tickets')}
          value={Array.isArray(tickets) ? tickets.map(t => t._id) : []}
          onChange={onChange}
          onToggle={onToggle}
          onSearch={onSearch}
        />
      )}
    </>
  );

};

export default AddTickets;
