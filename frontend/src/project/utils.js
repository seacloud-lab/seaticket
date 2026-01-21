import { mediaUrl, siteRoot } from '@/constants';
import { KNOWLEDGE_BASE_TYPE } from './main-panel/knowledge-base/constants';
import { generatorKnowledgeBaseURL } from './main-panel/knowledge-base/utils';
import { TICKET_TYPE } from './main-panel/tickets/constants';
import { getConnectionIcon, getOriginalPageUrl } from './main-panel/connections/utils';
import { generatorTicketURL } from './main-panel/tickets/utils';

export const getResourceIconURL = (type) => {
  const root = `${siteRoot}${mediaUrl}`.replaceAll('//', '/');
  if (type === 'unknown') return `${root}img/unknown.png`;
  if (type === TICKET_TYPE) return `${root}img/ticket.png?t=20260104`;
  if (type === KNOWLEDGE_BASE_TYPE) return `${root}img/knowledge-base.png?t=20260104`;
  return getConnectionIcon(type);
};

export const getInternalNetworkAddress = (type, resourceID, { workspaceID, projectName, connectionID }) => {
  if (type === TICKET_TYPE) return generatorTicketURL({ ticket: { _id: resourceID, }, workspaceID, projectName });
  if (type === KNOWLEDGE_BASE_TYPE) return generatorKnowledgeBaseURL({ kb: { _id: resourceID }, workspaceID, projectName });
  const baseURL = location.origin + siteRoot + 'workspace/' + workspaceID + '/project/' + projectName + '/';
  return `${baseURL}connections/${connectionID}/records/${resourceID}/`;
};

export const getResourceOriginalURL = (type, resource, { workspaceID, projectName, connections, columns }) => {
  if (type === TICKET_TYPE || type === KNOWLEDGE_BASE_TYPE) return '';
  const connection = connections.find(c => c.id === resource.connection_id);
  if (!connection) return '';
  return getOriginalPageUrl(connection, resource, columns);
};

export const shouldReload = (timestamp = 0) => {
  // 36000000(1h): 60 * 60 * 1000
  if (!timestamp) return true;
  return Date.now() - timestamp > 3600000;
};
