import { PORTAL_CHAT_EXTRA_SOURCES, PORTAL_CHAT_ALLOWED_SOURCES_DEFAULT } from '@/project/constants';

export const isConnectionActive = (connection) => !!connection?.is_active;

export const normalizeExtraSources = (extraSources = []) => {
  if (!Array.isArray(extraSources)) return [];
  return PORTAL_CHAT_EXTRA_SOURCES.filter((source) => extraSources.includes(source));
};

export const normalizeChatAllowedSources = (rawChatAllowedSources, connections = []) => {
  if (!rawChatAllowedSources || Array.isArray(rawChatAllowedSources) || typeof rawChatAllowedSources !== 'object') {
    return PORTAL_CHAT_ALLOWED_SOURCES_DEFAULT;
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
