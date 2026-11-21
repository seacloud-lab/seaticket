import { mediaUrl, siteRoot, gettext } from '@/constants';
import { BAR_TYPE } from './constants/bar';
import { CONNECTION_TYPES } from './main-panel/connections/constants';
import { getConnectionIcon, getOriginalPageUrl } from './main-panel/connections/utils';
import { KNOWLEDGE_BASE_TYPE } from './main-panel/knowledge-base/constants';
import { generatorKnowledgeBaseURL } from './main-panel/knowledge-base/utils';
import { PORTAL_ISSUE_TYPE } from './main-panel/portal-issues/constants';
import { generatorIssueURL } from './main-panel/portal-issues/utils';
import { TICKET_TYPE } from './main-panel/tickets/constants';
import { generatorTicketURL } from './main-panel/tickets/utils';


export const MY_TICKETS_SCOPE = {
  ASSIGNED: 'assigned',
  CREATED: 'created',
};

export const getMyTicketsScope = (bar) => {
  if (bar === BAR_TYPE.MY_TICKET) return MY_TICKETS_SCOPE.ASSIGNED;
  if (bar === BAR_TYPE.MY_CREATED_TICKET) return MY_TICKETS_SCOPE.CREATED;
  return null;
};

export const getMyTicketsBar = (search) => {
  const scope = new URLSearchParams(search).get('scope');
  return scope === MY_TICKETS_SCOPE.CREATED ? BAR_TYPE.MY_CREATED_TICKET : BAR_TYPE.MY_TICKET;
};

export const getMyTicketsURL = (projectURL, scope, search = '') => {
  const params = new URLSearchParams(search);
  if (scope === MY_TICKETS_SCOPE.CREATED) {
    params.set('scope', scope);
  } else {
    params.delete('scope');
  }
  const query = params.toString();
  return `${projectURL}${BAR_TYPE.MY_TICKET}/${query ? `?${query}` : ''}`;
};

export const getResourceIconURL = (type) => {
  const root = `${siteRoot}${mediaUrl}`.replaceAll('//', '/');
  switch (type) {
    case 'unknown': {
      return `${root}img/unknown.png`;
    }
    case TICKET_TYPE: {
      return `${root}img/ticket.png?t=20260104`;
    }
    case PORTAL_ISSUE_TYPE: {
      return `${root}img/portal-logo.png?t=20260904`;
    }
    case KNOWLEDGE_BASE_TYPE: {
      return `${root}img/knowledge-base.png?t=20260104`;
    }
    default: {
      return getConnectionIcon(type);
    }
  }
};

export const getResourceTypeName = (type) => {
  if (type === TICKET_TYPE) return gettext('Ticket');
  if (type === PORTAL_ISSUE_TYPE) return gettext('Portal issue');
  return CONNECTION_TYPES.find(c => c.type === type)?.name || type;
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
      const baseURL = location.origin + siteRoot + 'workspace/' + workspaceID + '/project/' + encodeURIComponent(projectName) + '/';
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
