import React from 'react';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import EmailDetail from './email-detail';
import NormalDetail from './normal-detail';
import TicketDetail from './ticket-detail';

const Detail = ({ type, sourceType, ...props }) => {
  if (type === 'suggest_create_ticket') return (<TicketDetail { ...props } />);
  if (type === 'suggest_reply' && sourceType === CONNECTION_TYPE.EMAIL) return (<EmailDetail { ...props } />);
  return (<NormalDetail { ...props } />);
};

export default Detail;
