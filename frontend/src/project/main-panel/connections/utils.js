import { mediaUrl } from '@/constants';
import { CONNECTION_TYPES } from './constants';

export const getConnectionIcon = (type) => {
  if (!type) return null;
  const connection = CONNECTION_TYPES.find(c => c.type === type);
  if (!connection) return null;
  return `${mediaUrl}img/connection/${connection.icon}.png`;
};
