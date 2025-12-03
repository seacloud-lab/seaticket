import { mediaUrl, projectName, server, workspaceID } from '@/constants';
import { CONNECTION_TYPE, CONNECTION_TYPES } from './constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';

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
      return `${server}/workspace/${workspaceID}/project/${projectName}/connections/${connection.id}/records/${row._id}/`;
    }
    default: {
      return '';
    }
  }
};
