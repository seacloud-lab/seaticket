import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Table from '../table';
import CenteredLoading from '../../../components/centered-loading';
import toaster from '../../../components/toaster';
import { seaQAAPI } from '../../../api/web-api';
import { TicketObject, ReplyObject } from '../../models';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { TABLE_COLUMN_TYPE } from '../../constants';
import { Input, Button } from 'reactstrap';

const {
  projectUuid,
} = window.app.pageOptions;

const Tickets = () => {

  const [isLoading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [isShowTicket, setIsShowTicket] = useState(false);
  const [isCreateTicket, setIsCreateTicket] = useState(false);
  const [isModifyTicket, setIsModifyTicket] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [participants, setParticipants] = useState([]);
  const [tags, setTags] = useState([]);
  const [reply, setReply] = useState('');
  const [isChanged, setChanged] = useState(false);

  const columns = useMemo(() => {
    return [
      { key: 'number', name: gettext('Number'), type: TABLE_COLUMN_TYPE.TEXT, width: '25%' },
      { key: 'title', name: gettext('Title'), type: TABLE_COLUMN_TYPE.TEXT, width: '25%' },
      { key: 'status', name: gettext('Status'), type: TABLE_COLUMN_TYPE.TEXT, width: '10%' },
      { key: 'created_at', name: gettext('Create time'), type: TABLE_COLUMN_TYPE.DATE, width: '15%' },
      { key: 'reply_updated_at', name: gettext('Last Update'), type: TABLE_COLUMN_TYPE.TEXT, width: '15%' },
      { key: 'op', name: '', type: TABLE_COLUMN_TYPE.OP, width: '10%' },
    ];
  }, []);
  const btns = useMemo(() => {
    return [
      {
        name: gettext('Add'), func: () => {
          activeTicketRef.current = null;
          openCreateTicket();
        }
      }
    ];
  }, []);

  const pageRef = useRef(1);
  const pageCountRef = useRef(Math.max(parseInt(window.innerHeight / 41) + 1, 100));
  const hasMoreRef = useRef(true);

  const activeTicketRef = useRef(null);

  const openCreateTicket = useCallback(() => {
    setIsCreateTicket(true);
  }, []);

  const closeCreateTicket = useCallback(() => {
    activeTicketRef.current = null;
    setIsCreateTicket(false);
  }, []);

  const openModifyTicket = useCallback((Ticket) => {
    activeTicketRef.current = Ticket;
    setIsModifyTicket(true);
  }, []);

  const closeModifyTicket = useCallback(() => {
    activeTicketRef.current = null;
    setIsModifyTicket(false);
  }, []);

  const openShowTicket = useCallback((ticket) => {
    activeTicketRef.current = ticket;
    getTicket();
    // setIsShowTicket(true);
  }, []);

  const closeShowTicket = useCallback(() => {
    activeTicketRef.current = null;
    setIsShowTicket(false);
  }, []);

  const createTicket = useCallback(() => {
    seaQAAPI.createProjectTicket(projectUuid, title, content, type, participants, tags).then(res => {
      const newTicket = new TicketObject(res.data.ticket);
      const newTickets = [newTicket, ...tickets];
      setTickets(newTickets);
      setTitle('');
      setContent('');
      closeCreateTicket();
      openShowTicket(newTicket);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [title, content, type, participants, tags]);

  const modifyTicket = useCallback((resetSubmittingState) => {
    seaQAAPI.modifyProjectTicket(projectUuid, activeTicketRef.current.id, title, content, status, type, participants, tags).then(res => {
      const activeTicketIndex = tickets.findIndex(c => c.id === activeTicketRef.current.id);
      const newTicket = new TicketObject(res.data.Ticket);
      let newTickets = tickets.slice(0);
      if (activeTicketIndex === -1) {
        newTickets.push(newTicket);
      } else {
        newTickets[activeTicketIndex] = newTicket;
      }
      setTickets(newTickets);
      activeTicketRef.current = null;
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, [title, content, status, type, participants, tags]);

  const getTicket = useCallback((resetSubmittingState) => {
    seaQAAPI.getProjectTicket(projectUuid, activeTicketRef.current.id).then(res => {
      const newTicket = new TicketObject(res.data.ticket);
      activeTicketRef.current = newTicket;
      setIsShowTicket(true);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      resetSubmittingState && resetSubmittingState();
    });
  }, []);

  const createReply = useCallback(() => {
    seaQAAPI.createProjectTicketReply(projectUuid, activeTicketRef.current.id, reply).then(res => {
      const newReply = new ReplyObject(res.data.ticket_reply);
      const newReplies = [...activeTicketRef.current.replies, newReply];
      activeTicketRef.current.replies = newReplies;
      setReply('');
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [reply]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current) return;
    setLoading(true);
    seaQAAPI.listProjectTickets(projectUuid).then(res => {
      const tickets = res.data.tickets.map(r => new TicketObject(r));
      let newTickets = pageRef.current === 1 ? [] : tickets.slice(0);
      let ticketsMap = newTickets.reduce((pre, cur) => {
        if (pre[cur.id]) return pre;
        pre[cur.id] = true;
        return pre;
      }, {});

      if (tickets.length < pageCountRef.current) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = pageRef.current + 1;
      }

      tickets.forEach(Ticket => {
        if (!ticketsMap[Ticket.id]) {
          newTickets.push(Ticket);
        }
      });
      setTickets(newTickets);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [tickets, isLoading]);

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadMore();
  }, []);

  const onTitleChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === title) return;
    setChanged(true);
    setTitle(newValue);
  }, [title]);

  const onContentChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === content) return;
    setChanged(true);
    setContent(newValue);
  }, [content]);

  const onStatusChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === status) return;
    setChanged(true);
    setStatus(newValue);
  }, [status]);

  const onTypeChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === type) return;
    setChanged(true);
    setType(newValue);
  }, [type]);

  const onParticipantsChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === participants) return;
    setChanged(true);
    setParticipants(newValue);
  }, [participants]);

  const onTagsChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === tags) return;
    setChanged(true);
    setTags(newValue);
  }, [tags]);

  const onReplyChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === reply) return;
    setChanged(true);
    setReply(newValue);
  }, [reply]);

  const renderTickets = (() => {
    return (
      <>
        <Table
          columns={columns}
          rows={tickets}
          title={'tickets'}
          btns={btns}
          emptyTip={gettext('There are no tickets yet')}
          isLoading={isLoading}
          loadMore={loadMore}
          onDelete={() => { }}
          onModify={openShowTicket}
        >
          <Table.Header title={''} btns={btns} />
        </Table>
      </>
    );
  });

  const renderTicket = (() => {
    return (
      <>
        <p>{'title: '}{activeTicketRef.current.title}</p>
        <p>{'content: '}{activeTicketRef.current.content}</p>
        <p>{'status: '}{activeTicketRef.current.status}</p>
        <p>{'type: '}{activeTicketRef.current.type}</p>
        <p>{'participants: '}{activeTicketRef.current.participants.toString()}</p>
        <p>{'tags: '}{activeTicketRef.current.tags.toString()}</p>
        {activeTicketRef.current.replies.map(row => {
          return (
            <div className="sea-qa-project-custom-table-row" key={row.id}>
              <div className="sea-qa-project-custom-table-cell">{'reply'}{row.id}{': '}{row.content}</div>
            </div>
          );
        })}
        <Input value={reply} onChange={onReplyChange} autoFocus placeholder={gettext('Please input reply')} id="ticket-reply" />
        <Button color="primary" onClick={createReply} >{gettext('Submit')}</Button>
      </>
    );
  });

  const renderCreateTicket = (() => {
    return (
      <>
        <Input value={title} onChange={onTitleChange} autoFocus placeholder={gettext('Please input title')} id="ticket-title" />
        <Input value={content} onChange={onContentChange} autoFocus placeholder={gettext('Please input content')} id="ticket-content" />
        <Input value={type} onChange={onTypeChange} autoFocus placeholder={gettext('Please input type')} id="ticket-type" />
        <Input value={participants} onChange={onParticipantsChange} autoFocus placeholder={gettext('Please input participants')} id="ticket-participants" />
        <Input value={tags} onChange={onTagsChange} autoFocus placeholder={gettext('Please input tags')} id="ticket-tags" />
        <Button color="primary" onClick={createTicket} >{gettext('Submit')}</Button>
      </>
    );
  });

  const renderModifyTicket = (() => {
    return (
      <>
        <Input value={title} onChange={onTitleChange} autoFocus placeholder={gettext('Please input title')} id="ticket-title" />
        <Input value={content} onChange={onContentChange} autoFocus placeholder={gettext('Please input content')} id="ticket-content" />
        <Input value={status} onChange={onStatusChange} autoFocus placeholder={gettext('Please input status')} id="ticket-status" />
        <Input value={type} onChange={onTypeChange} autoFocus placeholder={gettext('Please input type')} id="ticket-type" />
        <Input value={participants} onChange={onParticipantsChange} autoFocus placeholder={gettext('Please input participants')} id="ticket-participants" />
        <Input value={tags} onChange={onTagsChange} autoFocus placeholder={gettext('Please input tags')} id="ticket-tags" />
        <Button color="primary" onClick={createTicket} >{gettext('Submit')}</Button>
      </>
    );
  });

  if (isLoading && tickets.length === 0) return (<CenteredLoading />);
  return (
    <>
      {isShowTicket && renderTicket()}
      {isCreateTicket && renderCreateTicket()}
      {isModifyTicket && renderModifyTicket()}
      {!isShowTicket && !isCreateTicket && !isModifyTicket && renderTickets()}
    </>
  );
};

export default Tickets;
