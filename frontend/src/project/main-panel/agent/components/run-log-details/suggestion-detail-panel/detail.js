import React from 'react';
import NormalDetail from './normal-detail';
import TicketDetail from './ticket-detail';
import EmailDetail from './email-detail';

const Detail = ({ type, sourceType, ...props }) => {
  if (type === 'suggest_create_ticket') return (<TicketDetail { ...props } />);
  if (type === 'suggest_reply' && sourceType === 'email') return (<EmailDetail { ...props } />);
  return (<NormalDetail { ...props } />);
};

export default Detail;
