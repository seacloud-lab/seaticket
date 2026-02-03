import copy from 'copy-to-clipboard';
import { mediaUrl, server, gettext } from '@/constants';
import {
  CONNECTION_PAGE_SLUG_ID, CONNECTION_TYPE, CONNECTION_TYPES, CONNECTION_SYNC_COMPLETED_STATUS,
  CONNECTION_PREDEFINED_COLUMN_NAME, SUPPORT_AI_CONNECTION_TYPES, SUPPORT_MARK_OUTDATED_CONNECTION_TYPES,
  SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES, SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES,
} from './constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { isString } from '@/utils/type-detection';
import { toaster } from '@/components';

export const getConnectionIcon = (type) => {
  if (!type) return null;
  const connection = CONNECTION_TYPES.find(c => c.type === type);
  if (!connection) return `${mediaUrl}img/connection/sites.png`;
  return `${mediaUrl}img/connection/${connection.icon}.png`;
};

const getDiscourseOriginalPageUrl = (connection, row, columns) => {
  const slugColumn = getColumnByName(columns, 'slug');
  const topicIdColumn = getColumnByName(columns, 'topic_id');
  const discourseBaseUrl = connection.config?.url;
  if (!discourseBaseUrl) return '';
  const slug = getCellValueByColumn(row, slugColumn);
  const topic_id = getCellValueByColumn(row, topicIdColumn);
  if (!slug || !topic_id) return '';
  const baseUrl = discourseBaseUrl.replace(/\/$/, '');
  const originalPageUrl = `${baseUrl}/t/${slug}/${topic_id}`;
  return originalPageUrl;
};

const getSeafileOriginalPageUrl = (connection, row, columns) => {
  const { server_url, repo_id } = connection.config;
  if (!server_url || !repo_id) return '';
  const pathColumn = getColumnByName(columns, 'path');
  const titleColumn = getColumnByName(columns, 'title');
  const path = getCellValueByColumn(row, pathColumn);
  const title = getCellValueByColumn(row, titleColumn);
  if (!path || !title) return '';
  const baseUrl = server_url.replace(/\/$/, '');
  const filePath = path.replace(/\/$/, '');
  const originalPageUrl = `${baseUrl}/lib/${repo_id}/file${filePath}/${title}`;
  return originalPageUrl;
};

const getEmailOriginalPageUrl = (row) => {
  let details = row.details ? row.details : [];
  if (details.length === 0) {
    return '';
  }
  const email_id = details[details.length - 1].email_id;
  const origin_thread_id = details[details.length - 1].origin_thread_id;
  if (!email_id || ! origin_thread_id) {
    return '';
  }
  return 'https://app.fastmail.com/mail/all/' + origin_thread_id + '.' + email_id;
};

export const getOriginalPageUrl = (connection, row, columns) => {
  if (!connection || !row || !columns) return '';
  switch (connection.type) {
    case CONNECTION_TYPE.DISCOURSE_FORUM: {
      return getDiscourseOriginalPageUrl(connection, row, columns);
    }
    case CONNECTION_TYPE.SITE:
    case CONNECTION_TYPE.GITHUB_ISSUE: {
      const urlColumn = getColumnByName(columns, 'url');
      const url = getCellValueByColumn(row, urlColumn) || '';
      return url;
    }
    case CONNECTION_TYPE.SEAFILE: {
      return getSeafileOriginalPageUrl(connection, row, columns);
    }
    case CONNECTION_TYPE.EMAIL: {
      return getEmailOriginalPageUrl(row);
    }
    default: {
      return '';
    }
  }
};

export const isConnectionRecordsView = (page) => {
  return page !== CONNECTION_PAGE_SLUG_ID.ALL && page !== CONNECTION_PAGE_SLUG_ID.NEW;
};

// Format data according to different connection types,site and seafile only have one detail content
export const initConnectionResourceDetails = (type, {
  title,
  modified_time,
  content,
  author,
  created_time,
  comments,
  replies,
  emails,
  ...prams
}) => {
  if (type === CONNECTION_TYPE.SITE) {
    return {
      title: title,
      time: modified_time,
      details: content,
      ...prams
    };
  }
  if (type === CONNECTION_TYPE.SEAFILE) {
    return {
      title: title,
      time: modified_time,
      details: content,
      ...prams
    };
  }
  if (type === CONNECTION_TYPE.NOTION) {
    return {
      title: title,
      time: modified_time,
      details: content,
      ...prams
    };
  }
  if (type === CONNECTION_TYPE.GITHUB_ISSUE) {
    const mainPost = {
      author: author,
      time: created_time,
      body: content || '',
    };
    const initComments = Array.isArray(comments) && comments.length > 0 ? comments.map(detail => ({
      ...detail,
      time: detail.created_time,
      body: detail.content || '',
    })) : [];
    return {
      title,
      details: [mainPost, ...initComments],
      ...prams
    };
  }
  if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
    return {
      title,
      details: Array.isArray(replies) && replies.length > 0 ? replies.map(detail => ({
        ...detail,
        time: detail.modified_time,
        body: detail.content || '',
      })) : [],
      ...prams
    };
  }
  if (type === CONNECTION_TYPE.EMAIL) {
    return {
      title,
      details: Array.isArray(emails) && emails.length > 0 ? emails.map(detail => ({
        ...detail,
        time: detail.modified_time,
        body: detail.content || '',
      })) : [],
      ...prams
    };
  }
};

export const getInfoByEmailFrom = (emailFrom) => {
  if (!emailFrom) return { sender: '', email: '' };
  const regex = /^([^<]+?)\s*(?:<([^>]+)>)?$/;
  const match = emailFrom.match(regex);
  if (!match) return { sender: emailFrom, email: '' };
  const sender = match[1].trim();
  const email = match[2] ? match[2].trim() : null;
  return { sender, email };
};

export const generatorConnectionAssetURLPrefix = (projectUuid, connectionId) => {
  const assetURLPrefix = `${server.endsWith('/') ? server : server + '/'}file/project/${projectUuid}/connections/${connectionId}/path/`;
  return assetURLPrefix;
};

export const initConnectionStatus = (status = '') => {
  if (!status) return {};
  let validStatus = status;
  if (status && isString(status)) {
    try {
      validStatus = JSON.parse(status);
    } catch {
      validStatus = {};
    }
  }
  return validStatus;
};

export const getTableName = (connection) => {
  if (!connection) return '';
  return `${connection.type}_${connection.id}`;
};

export const isConnectionSyncCompleted = ({ status } = {}) => {
  const validStatus = initConnectionStatus(status);
  return CONNECTION_SYNC_COMPLETED_STATUS.includes(validStatus?.last_sync_status);
};

export const generatorRowClassName = (row, columns = []) => {
  if (!row || !Array.isArray(columns) || columns.length === 0) return '';
  const outdatedColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
  if (!outdatedColumn) return '';
  const value = getCellValueByColumn(row, outdatedColumn);
  if (value) return 'outdated-record';
  return '';
};

export const generateAIOptions = ({ rows, columns, connection }, callback) => {
  const enableUseAI = SUPPORT_AI_CONNECTION_TYPES.includes(connection?.type);
  if (!enableUseAI) return null;

  if (connection?.type === CONNECTION_TYPE.GITHUB_ISSUE || connection?.type === CONNECTION_TYPE.DISCOURSE_FORUM || connection?.type === CONNECTION_TYPE.EMAIL) {
    return {
      key: 'chat_issues',
      label: rows.length === 1 ? gettext('Chat issue') : gettext('Chat issues'),
      callback: () => {
        let newRows = [];
        const titleColumn = getColumnByName(columns, 'title');
        const stateColumn = getColumnByName(columns, 'state');
        const urlColumn = getColumnByName(columns, 'url');

        if (!titleColumn) return;
        rows.forEach(row => {
          const newRow = {
            _pk: row._id,
            title: getCellValueByColumn(row, titleColumn),
            state: getCellValueByColumn(row, stateColumn),
            url: getCellValueByColumn(row, urlColumn),
            connection_id: connection?.id,
            type: connection?.type,
          };
          newRows.push(newRow);
        });
        callback && callback(newRows);
      }
    };
  }

  return null;
};

export const generateMarkAsOutdatedOptions = ({ rows, columns, connection }, callback) => {
  const enableMarkAsOutdated = SUPPORT_MARK_OUTDATED_CONNECTION_TYPES.includes(connection?.type);
  if (!enableMarkAsOutdated) return [];
  const rowList = Array.isArray(rows) ? rows : [rows];
  if (rowList.length === 0) return [];
  const outdatedColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.OUTDATED);
  if (!outdatedColumn) return [];
  let activeRows = [];
  let outdatedRows = [];
  rows.forEach(row => {
    const oldValue = row[outdatedColumn.key];
    if (oldValue) {
      outdatedRows.push(row);
    } else {
      activeRows.push(row);
    }
  });
  let options = [];
  if (outdatedRows.length > 0) {
    options.push({
      key: 'mark_as_active',
      label: gettext('Mark as active'),
      callback: () => {
        let rowIds = [];
        let idRowUpdates = {};
        let idOldRowOldData = {};
        outdatedRows.forEach(row => {
          const { _id } = row;
          rowIds.push(_id);
          idRowUpdates[_id] = { [outdatedColumn.key]: false };
          idOldRowOldData[_id] = { [outdatedColumn.key]: true };
        });
        callback && callback(rowIds, idRowUpdates, idOldRowOldData, false);
      },
    });
  }
  if (activeRows.length > 0) {
    options.push({
      key: 'mark_as_outdated',
      label: gettext('Mark as outdated'),
      callback: () => {
        let rowIds = [];
        let idRowUpdates = {};
        let idOldRowOldData = {};
        activeRows.forEach(row => {
          const { _id } = row;
          const oldValue = row[outdatedColumn.key];
          rowIds.push(_id);
          idRowUpdates[_id] = { [outdatedColumn.key]: true };
          idOldRowOldData[_id] = { [outdatedColumn.key]: oldValue };
        });
        callback && callback(rowIds, idRowUpdates, idOldRowOldData, false);
      },
    });
  }
  return options.length > 0 ? options : [];
};

export const generateFindRelatedIssuesOption = ({ row, connection }, callback) => {
  const enableFindRelatedIssues = SUPPORT_FIND_RELATED_ISSUES_CONNECTION_TYPES.includes(connection?.type);
  if (!enableFindRelatedIssues) return null;
  return {
    key: 'find_related_issues',
    label: gettext('Find related issues'),
    callback: () => callback && callback(row),
  };
};

export const generateLinkAnExistingTicketOption = ({ row, columns, connection }, callback) => {
  const enableCreateRelatedTicket = SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES.includes(connection?.type);
  if (!enableCreateRelatedTicket) return null;

  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
  if (!column) return null;
  const cellValue = getCellValueByColumn(row, column);
  if (cellValue) return null;

  return {
    key: 'link_an_existing_ticket',
    label: gettext('Link an existing ticket'),
    callback: () => callback && callback(row),
  };
};


export const generateCreateRelatedTicketOption = ({ row, columns, connection }, callback) => {
  const enableCreateRelatedTicket = SUPPORT_CREATE_RELATED_TICKET_CONNECTION_TYPES.includes(connection?.type);
  if (!enableCreateRelatedTicket) return null;

  const column = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.LINKED_TICKET);
  if (!column) return null;
  const cellValue = getCellValueByColumn(row, column);
  if (cellValue) return null;

  return {
    key: 'create_related_ticket',
    label: gettext('Create related ticket'),
    callback: () => callback && callback(row),
  };
};


export const generateOpenOriginalPageOption = ({ connection, row, columns }) => {
  const url = getOriginalPageUrl(connection, row, columns);
  if (!url) return null;
  return {
    label: gettext('Open original page'),
    key: 'open_original_page',
    callback: () => window.open(url, '_blank', 'noopener,noreferrer'),
  };
};

export const generateCopyOriginalLinkOption = ({ connection, row, columns }) => {
  const url = getOriginalPageUrl(connection, row, columns);
  if (!url) return null;
  return {
    label: gettext('Copy original link'),
    key: 'copy_original_link',
    callback: () => {
      const urlObj = new URL(url);
      copy(urlObj.href);
      toaster.success(gettext('The original link has been copied'));
    },
  };
};

