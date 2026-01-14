import { mediaUrl } from '@/constants';
import { KNOWLEDGE_BASE_TYPE } from './main-panel/knowledge-base/constants';
import { generatorKnowledgeBaseURL } from './main-panel/knowledge-base/utils';
import { TICKET_TYPE } from './main-panel/tickets/constants';
import { getConnectionIcon, getOriginalPageUrl } from './main-panel/connections/utils';
import { CONNECTION_TYPE } from './main-panel/connections/constants';
import { generatorTicketURL } from './main-panel/tickets/utils';

export const getResourceIconURL = (type) => {
  if (type === 'unknown') return `${mediaUrl}img/unknown.png`;
  if (type === TICKET_TYPE) return `${mediaUrl}img/ticket.png?t=20260104`;
  if (type === KNOWLEDGE_BASE_TYPE) return `${mediaUrl}img/knowledge-base.png?t=20260104`;
  return getConnectionIcon(type);
};

export const getResourceURL = (type, resourceID, { url, workspaceID, projectName, connectionID }) => {
  if (url) return url;
  if (type === TICKET_TYPE) return generatorTicketURL({ ticket: { _id: resourceID, }, workspaceID, projectName });
  if (type === KNOWLEDGE_BASE_TYPE) return generatorKnowledgeBaseURL({ kb: { _id: resourceID }, workspaceID, projectName });
  const baseURL = location.origin + '/workspace/' + workspaceID + '/project/' + projectName + '/';
  if (type === CONNECTION_TYPE.EMAIL) return `${baseURL}connections/${connectionID}/records/${resourceID}/`;
  return `${baseURL}connections/${connectionID}/`;
};

export const getResourceOriginalURL = (type, resource, { workspaceID, projectName, connections, columns }) => {
  if (type === TICKET_TYPE) return generatorTicketURL({ ticket: resource, workspaceID, projectName });
  if (type === KNOWLEDGE_BASE_TYPE) return generatorKnowledgeBaseURL({ kb: resource, workspaceID, projectName });
  const connection = connections.find(c => c.id === resource.connection_id);
  if (!connection) return '';
  return getOriginalPageUrl(connection, resource, columns);
};
