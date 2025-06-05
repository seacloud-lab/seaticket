export const QUERY_TYPE = {
  BASE: 'base',
  APP: 'app',
  WORKFLOW: 'workflow',
};

export const SEARCHED_STORE_KEY = {
  [QUERY_TYPE.BASE]: 'bases',
  [QUERY_TYPE.APP]: 'apps',
  [QUERY_TYPE.WORKFLOW]: 'workflows',
};

export const RECENT_USED_STORE_KEY = 'recentUsedDtableSearchResults';

export const QUERY_TYPE_DISPLAY = {
  [QUERY_TYPE.BASE]: 'Bases',
  [QUERY_TYPE.WORKFLOW]: 'Workflows',
  [QUERY_TYPE.APP]: 'Apps',
};
