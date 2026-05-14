import { CHAT_EXTRA_SOURCES, EMPTY_CHAT_ALLOWED_SOURCES } from './constants';

export const isConnectionActive = (connection) => !!connection?.is_active;

export const normalizeExtraSources = (extraSources = []) => {
  if (!Array.isArray(extraSources)) return [];
  return CHAT_EXTRA_SOURCES.filter((source) => extraSources.includes(source));
};

export const normalizeChatAllowedSources = (rawChatAllowedSources, connections = []) => {
  if (!rawChatAllowedSources || Array.isArray(rawChatAllowedSources) || typeof rawChatAllowedSources !== 'object') {
    return EMPTY_CHAT_ALLOWED_SOURCES;
  }

  const rawConnectionIds = Array.isArray(rawChatAllowedSources.connection_ids) ? rawChatAllowedSources.connection_ids : [];
  const extraSources = normalizeExtraSources(rawChatAllowedSources.extra_sources);

  const rawConnectionIdSet = new Set(rawConnectionIds.map(String));
  return {
    connection_ids: connections
      .filter((connection) => isConnectionActive(connection) && rawConnectionIdSet.has(String(connection.id)))
      .map((connection) => connection.id),
    extra_sources: extraSources,
  };
};
