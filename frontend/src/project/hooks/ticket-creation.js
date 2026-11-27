import React, { useContext } from 'react';

export const TicketCreationContext = React.createContext(null);

export const useTicketCreation = () => {
  const context = useContext(TicketCreationContext);
  if (!context) {
    throw new Error('\'TicketCreationContext\' is null');
  }
  return context;
};
