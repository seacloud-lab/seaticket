import { QUERY_TYPE, RECENT_USED_STORE_KEY } from './constant';

const MAX_STORE_RECENT_LENGTH = 30;

export const getNormalizeSearchedList = (searchedList, queryType) => {
  if (!Array.isArray(searchedList)) {
    return [];
  }
  return searchedList.map((searchedItem) => {
    let normalizedSearchedItem = {
      ...searchedItem,
      query_type: queryType,
    };
    switch (queryType) {
      case QUERY_TYPE.PROJECT: {
        normalizedSearchedItem.searched_id = searchedItem.id;
        break;
      }
      default: {
        break;
      }
    }
    return normalizedSearchedItem;
  });
};

export const loadRecentUsed = () => {
  const sRecentUsed = window.localStorage.getItem(RECENT_USED_STORE_KEY);
  const recentUsed = sRecentUsed && JSON.parse(sRecentUsed);
  return Array.isArray(recentUsed) ? recentUsed : [];
};

const storeRecentUsed = (recentUsed) => {
  window.localStorage.setItem(RECENT_USED_STORE_KEY, JSON.stringify(recentUsed));
};

export const storeSearchedItem = (searchedItem) => {
  if (!searchedItem) return;
  const recentUsed = loadRecentUsed();
  if (recentUsed.length === 0) {
    storeRecentUsed([searchedItem]);
    return;
  }
  const { query_type, searched_id } = searchedItem;
  const sameRecentUsedItemIndex = recentUsed.findIndex((recentUsedItem) => {
    return recentUsedItem.query_type === query_type && recentUsedItem.searched_id === searched_id;
  });
  if (sameRecentUsedItemIndex > -1) {
    recentUsed.splice(sameRecentUsedItemIndex, 1);
  }
  recentUsed.unshift(searchedItem);
  if (recentUsed.length > MAX_STORE_RECENT_LENGTH) {
    recentUsed.pop();
  }
  storeRecentUsed(recentUsed);
};
