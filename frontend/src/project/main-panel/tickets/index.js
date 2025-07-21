import React, { useCallback, useEffect, useState } from 'react';
import { TicketsProvider } from '../../hooks';
import { isNumber } from '../../../utils/type-detection';
import AllTickets from './all-tickets';
import NewTicket from './new-ticket';
import Ticket from './ticket';
import { BAR_TYPE } from '../../constants';

import './index.css';

const {
  projectUuid, projectName,
} = window.app.pageOptions;

const Index = () => {
  const [type, setType] = useState('all');

  useEffect(() => {
    const { pathname } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const paramsString = decodePathname.slice(projectNameIndex + projectName.length + 1);
    const params = paramsString.split('/');
    const [, ticketType = ''] = params;
    if (ticketType === 'new') {
      setType('new');
    } else {
      const ticketNumber = Number(ticketType);
      setType(ticketType && isNumber(ticketNumber) ? ticketNumber : 'all');
    }
  }, []);

  useEffect(() => {
    const { pathname, origin } = location;
    const decodePathname = decodeURIComponent(pathname);
    const projectNameIndex = decodePathname.indexOf(projectName);
    const newPathname = decodePathname.slice(0, projectNameIndex + projectName.length + 1);
    const urlPart = type === 'all' ? '/' : `/${type}/`;
    history.replaceState(null, null, origin + newPathname + BAR_TYPE.TICKET + urlPart);
  }, [type]);

  const togglePage = useCallback((type) => {
    setType(type);
  }, []);

  const renderContent = useCallback((type) => {
    if (type === 'all') return (<AllTickets togglePage={togglePage} />);
    if (type === 'new') return (<NewTicket togglePage={togglePage} />);
    return (<Ticket togglePage={togglePage} />);
  }, [togglePage]);

  return (
    <TicketsProvider projectUuid={projectUuid} type={type}>
      {renderContent(type)}
    </TicketsProvider>
  );
};

export default Index;
