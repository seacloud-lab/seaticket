import { mediaUrl } from '@/constants';
import { CONNECTION_TYPE, CONNECTION_TYPES } from './constants';

export const getConnectionIcon = (type) => {
  if (!type) return null;
  const connection = CONNECTION_TYPES.find(c => c.type === type);
  if (!connection) return null;
  return `${mediaUrl}img/connection/${connection.icon}.png`;
};

const getDiscourseOriginalPageUrl = (connection, row) => {
  const discourseBaseUrl = connection.config?.url;
  if (!discourseBaseUrl || !row.slug || !row.topic_id) return '';
  const baseUrl = discourseBaseUrl.replace(/\/$/, '');
  const originalPageUrl = `${baseUrl}/t/${row.slug}/${row.topic_id}`;
  return originalPageUrl;
};

const getSeafileOriginalPageUrl = (connection, row) => {
  const { server_url, repo_id } = connection.config;
  const { path, title } = row;
  if (!server_url || !repo_id || !title || !path) return '';
  const baseUrl = server_url.replace(/\/$/, '');
  const filePath = path.replace(/\/$/, '');
  const originalPageUrl = `${baseUrl}/lib/${repo_id}/file${filePath}/${title}`;
  return originalPageUrl;
};

export const getOriginalPageUrl = (connection, row) => {
  if (!connection || !row) return '';
  switch (connection.type) {
    case CONNECTION_TYPE.DISCOURSE_FORUM: {
      return getDiscourseOriginalPageUrl(connection, row);
    }
    case CONNECTION_TYPE.SITE:
    case CONNECTION_TYPE.GITHUB_ISSUE: {
      return row?.url;
    }
    case CONNECTION_TYPE.SEAFILE: {
      return getSeafileOriginalPageUrl(connection, row);
    }
    default: {
      return '';
    }
  }
};
