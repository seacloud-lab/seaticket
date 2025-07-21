import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import { gettext, mediaUrl } from '../../../../constants';
import { useTickets } from '../../../hooks';
import { CenteredLoading, EmptyTip, Icon, Option, SearchInput } from '../../../../components';

import './index.css';
import { TICKET_STATUS, TICKET_TYPES } from '../../../constants';

const AllTickets = ({ togglePage }) => {
  const { isLoading, metadata, loadMoreTickets } = useTickets();

  const onScroll = useCallback((event) => {
    if (isLoading) return;
    if (!loadMoreTickets) return;
    const clientHeight = event.target.clientHeight;
    const scrollHeight = event.target.scrollHeight;
    const scrollTop = event.target.scrollTop;
    const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
    if (!isBottom) return;
    loadMoreTickets();
  }, [isLoading, loadMoreTickets]);

  if (isLoading && metadata.rows.length === 0) return (<CenteredLoading />);

  return (
    <div className="sea-qa-project-all-tickets-wrapper">
      <div className="sea-qa-project-all-tickets-wrapper-header">
        <SearchInput placeholder={gettext('Search tickets')} />
        <Button color="primary" className="ml-4" onClick={() => togglePage('new')}>{gettext('New ticket')}</Button>
      </div>
      <div className="sea-qa-project-all-tickets-wrapper-body sea-qa-project-all-tickets">
        <div className="sea-qa-project-all-tickets-header p-2 sea-qa-project-all-tickets-op-wrapper">
          <div className="sea-qa-project-all-tickets-op-wrapper-left">
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Open')}</div>
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Close')}</div>
          </div>
          <div className="sea-qa-project-all-tickets-op-wrapper-right">
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Author')}</div>
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Labels')}</div>
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Assignees')}</div>
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Types')}</div>
            <div className="sea-qa-project-all-tickets-op-btn">{gettext('Newest')}</div>
          </div>
        </div>
        <div className="sea-qa-project-all-tickets-body">
          {metadata.rows.length === 0 ? (
            <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No tickets')} />
          ) : (
            <div className="sea-qa-project-all-tickets-records" onScroll={onScroll}>
              {metadata.rows.map(row => {
                const { id, title, status, type, creator, created_at, reply_count, tags } = row;
                const isOpen = status === '' || status === TICKET_STATUS.OPEN;
                const typeOption = TICKET_TYPES.find(o => o.id === type);
                return (
                  <div key={id} className="sea-qa-project-all-tickets-record">
                    <div className="sea-qa-project-all-tickets-record-status">
                      <Icon symbol={isOpen ? 'circle-dot' : 'circle-check'} />
                    </div>
                    <div className="sea-qa-project-all-tickets-record-primary">
                      <div className="sea-qa-project-all-tickets-record-title" onClick={() => togglePage(id)}>{title}</div>
                      {tags.map(tag => {
                        return (<div key={tag} className="sea-qa-project-all-tickets-record-tag">{tag}</div>);
                      })}
                    </div>
                    <div className="sea-qa-project-all-tickets-record-main-content">
                      {typeOption && (<Option option={typeOption} className="sea-qa-project-all-tickets-record-type" /> )}
                      <div className="sea-qa-project-all-tickets-record-create">
                        {isOpen ? `#${id} · ${creator.name || ''} opened ${created_at}` : `#${id} · by ${creator.name} was closed ${created_at}`}
                      </div>
                    </div>
                    <div className="sea-qa-project-all-tickets-record-reply">
                      {reply_count && (
                        <>
                          <Icon symbol="comments" />
                          <span className="ml-1">{reply_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllTickets;
