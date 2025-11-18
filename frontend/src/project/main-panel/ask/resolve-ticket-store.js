let resolveTicketData = null;

export const setResolveTicketData = (data) => {
  resolveTicketData = data;
};

export const consumeResolveTicketData = () => {
  const data = resolveTicketData;
  resolveTicketData = null;
  return data;
};

