import { mediaUrl, server } from '@/constants';
import {
  CONNECTION_PAGE_SLUG_ID, CONNECTION_TYPE, CONNECTION_TYPES, CONNECTION_SYNC_COMPLETED_STATUS,
  CONNECTION_PREDEFINED_COLUMN_NAME,
} from './constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { isString } from '@/utils/type-detection';

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
