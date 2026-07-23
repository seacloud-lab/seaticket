import React from 'react';
import NormalDetail from './normal-detail';
import TicketDetail from './ticket-detail';

const Detail = ({ type, ...props }) => {
  if (type === 'suggest_create_ticket') return (<TicketDetail { ...props } />);
  return (<NormalDetail { ...props } />);
};

export default Detail;
