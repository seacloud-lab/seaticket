import { mediaUrl, siteRoot } from '@/constants';
import { KNOWLEDGE_BASE_TYPE } from './main-panel/knowledge-base/constants';
import { generatorKnowledgeBaseURL } from './main-panel/knowledge-base/utils';
import { TICKET_TYPE } from './main-panel/tickets/constants';
import { PORTAL_ISSUE_TYPE } from './main-panel/portal-issues/constants';
import { getConnectionIcon, getOriginalPageUrl } from './main-panel/connections/utils';
import { generatorTicketURL } from './main-panel/tickets/utils';
import { generatorIssueURL } from './main-panel/portal-issues/utils';

export const getResourceIconURL = (type) => {
  const root = `${siteRoot}${mediaUrl}`.replaceAll('//', '/');
  switch (type) {
    case 'unknown': {
      return `${root}img/unknown.png`;
    }
    case TICKET_TYPE:
    case PORTAL_ISSUE_TYPE: {
      return `${root}img/ticket.png?t=20260104`;
    }
    case KNOWLEDGE_BASE_TYPE: {
      return `${root}img/knowledge-base.png?t=20260104`;
    }
    default: {
      return getConnectionIcon(type);
    }
  }
};

export const getInternalNetworkAddress = (type, resourceID, { workspaceID, projectName, connectionID }) => {
  switch (type) {
    case TICKET_TYPE: {
      return generatorTicketURL({ ticket: { _id: resourceID, }, workspaceID, projectName });
    }
    case PORTAL_ISSUE_TYPE: {
      return generatorIssueURL({ issue: { _id: resourceID, }, workspaceID, projectName });
    }
    case KNOWLEDGE_BASE_TYPE: {
      return generatorKnowledgeBaseURL({ kb: { _id: resourceID }, workspaceID, projectName });
    }
    default:
      const baseURL = location.origin + siteRoot + 'workspace/' + workspaceID + '/project/' + projectName + '/';
      return `${baseURL}connections/${connectionID}/records/${resourceID}/`;
  }
};

export const getResourceOriginalURL = (type, resource, connections, columns) => {
  if (type === TICKET_TYPE || type === PORTAL_ISSUE_TYPE || type === KNOWLEDGE_BASE_TYPE) return '';
  const connection = connections.find(c => (c.id + '') === (resource.connection_id + ''));
  if (!connection) return '';
  return getOriginalPageUrl(connection, resource, columns);
};

export const shouldReload = (timestamp = 0) => {
  // 36000000(1h): 60 * 60 * 1000
  if (!timestamp) return true;
  return Date.now() - timestamp > 3600000;
};

export const normalizeContextMenuOptions = (oldOptions = []) => {
  let options = oldOptions.slice(0);
  options = options.filter(Boolean);
  if (options[0] === 'Divider') {
    options.shift();
  }
  if (options.length > 0 && options[options.length - 1] === 'Divider') {
    options.pop();
  }
  options = options.reduce((acc, item, index, array) => {
    if (item === 'Divider' && index > 0 && array[index - 1] === 'Divider') {
      return acc;
    }
    acc.push(item);
    return acc;
  }, []);
  return options;
};

export const normalizeRowsMoreTools = (oldTools = []) => {
  let tools = oldTools.slice(0);
  tools = tools.filter(Boolean);
  if (tools[0]?.key === 'divider') {
    tools.shift();
  }
  if (tools[tools.length - 1]?.key === 'divider') {
    tools.pop();
  }
  tools = tools.reduce((acc, item, index, array) => {
    if (item && item.key === 'divider' && index > 0 && array[index - 1] && array[index - 1].key === 'divider') {
      return acc;
    }
    acc.push(item);
    return acc;
  }, []);
  return tools;
};
