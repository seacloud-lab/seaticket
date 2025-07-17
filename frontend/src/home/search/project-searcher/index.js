import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import SearchedList from './searched-list';
import { Loading, SearchInput } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import { getValueLength } from '../search-utils';
import { gettext } from '../../../constants';
import { QUERY_TYPE, SEARCHED_STORE_KEY, QUERY_TYPE_DISPLAY } from './constant';
import { getNormalizeSearchedList, loadRecentUsed, storeSearchedItem } from './utils';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 800;
const DISTANCE_BOTTOM = 100;
const ITEM_HEIGHT = 56;

const ProjectSearcher = (props) => {
  const [searchStr, setSearchStr] = useState('');
  const [currQueryType, setCurrQueryType] = useState(props.defaultQueryType || QUERY_TYPE.PROJECT);
  const [isLoading, setIsLoading] = useState(false);
  const [showRecent, setShowRecent] = useState(true);
  const [searchedRes, setSearchedRes] = useState({});

  const mounted = useRef(false);
  const searcherRef = useRef(null);
  const searchListContainerRef = useRef(null);
  const recentUsedRef = useRef([]);
  recentUsedRef.current = loadRecentUsed();

  const sendRequest = (queryData, queryType) => {
    setIsLoading(true);
    const query_str = queryData.q; // trimmed string
    seaQAAPI.searchItems(query_str, queryType).then(res => {
      const nextSearchedRes = {
        ...searchedRes,
        [SEARCHED_STORE_KEY[queryType]]: getNormalizeSearchedList(res.data.results, queryType),
      };
      setSearchedRes(nextSearchedRes);
      setIsLoading(false);
    }).catch(error => {
      setIsLoading(false);
    });
  };

  const searchWithQueryData = (searchStr, queryType) => {
    if (!searchStr) {
      setIsLoading(false);
      return;
    }
    const queryData = { q: searchStr };
    sendRequest(queryData, queryType);
  };

  const stopSearch = () => {
    setIsLoading(false);
    setSearchedRes({});
  };

  const startSearch = (searchStr) => {
    if (getValueLength(searchStr) < 3) {
      stopSearch();
      return;
    }
    setSearchStr(searchStr);
    searchWithQueryData(searchStr, currQueryType);
  };

  const clearSearch = () => {
    setSearchStr('');
    props.onCloseSearcher && props.onCloseSearcher();
  };

  const onChangeQueryType = (queryType) => {
    setCurrQueryType(queryType);
    if (searchedRes[SEARCHED_STORE_KEY[queryType]] || (!searchStr || getValueLength(searchStr) < 3)) {
      return;
    }
    searchWithQueryData(searchStr, queryType);
  };

  const handleUpArrow = (highlightIndex, searchedListLen) => {
    if (!searchListContainerRef.current || searchListContainerRef.current.scrollTop <= 0) {
      return;
    }
    const searchListHeight = searchListContainerRef.current.offsetHeight;
    const maxShowIndex = Math.floor(searchListHeight / ITEM_HEIGHT);
    if (highlightIndex < searchedListLen - maxShowIndex) {
      searchListContainerRef.current.scrollTop -= ITEM_HEIGHT;
    }
  };

  const handleDownArrow = (highlightIndex) => {
    if (!searchListContainerRef.current) {
      return;
    }
    const { offsetHeight, scrollTop, scrollHeight } = searchListContainerRef.current;
    const maxShowIndex = Math.floor(offsetHeight / ITEM_HEIGHT);
    if (offsetHeight + scrollTop >= scrollHeight || highlightIndex < maxShowIndex) {
      return;
    }
    searchListContainerRef.current.scrollTop += ITEM_HEIGHT;
  };

  const initSearcherStyle = () => {
    if (!searcherRef.current) {
      return;
    }
    const { top: offsetTop } = searcherRef.current.getBoundingClientRect();
    const clientHeight = document.body.clientHeight;
    let maxHeight = clientHeight - offsetTop - DISTANCE_BOTTOM;
    if (maxHeight <= MIN_HEIGHT) {
      maxHeight = MIN_HEIGHT;
    } else if (maxHeight >= MAX_HEIGHT) {
      maxHeight = MAX_HEIGHT;
    }
    searcherRef.current.style.maxHeight = `${maxHeight}px`;
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
    }
    initSearcherStyle();
  }, []);

  useEffect(() => {
    if (showRecent && searchStr) {
      setShowRecent(false);
    }
  }, [searchStr]);

  const renderRecentUsedResults = () => {
    const recentUsed = recentUsedRef.current;
    let currentTypeRecentUsed = [];
    if (Array.isArray(recentUsed)) {
      currentTypeRecentUsed = recentUsed.filter((searchedItem) => searchedItem.query_type === currQueryType);
    }
    if (currentTypeRecentUsed.length === 0) {
      return (
        <div className='search-result-none'>
          {gettext('No results matching')}
        </div>
      );
    }

    return (
      <div className='recent-used-search-results'>
        <div className='recent-used-title'>{gettext('Search results visited recently')}</div>
        <SearchedList
          searchedList={currentTypeRecentUsed}
          handleUpArrow={handleUpArrow}
          handleDownArrow={handleDownArrow}
          handleClickSearchedItem={storeSearchedItem}
        />
      </div>
    );
  };

  const renderSearchedResults = () => {
    if (isLoading) {
      return <Loading />;
    }

    const searchedList = searchedRes[SEARCHED_STORE_KEY[currQueryType]];
    if (!Array.isArray(searchedList) || searchedList.length === 0) {
      if (!searchStr) {
        return (
          <div className='search-result-none'>
            {gettext('Type characters to start search')}
          </div>
        );
      }
      else if (getValueLength(searchStr) < 3) {
        return (
          <div className='search-result-none'>
            {gettext('Type more characters to start search')}
          </div>
        );
      }
      else {
        return (
          <div className='search-result-none'>
            {gettext('No results matching')}
          </div>
        );
      }
    }

    return (
      <SearchedList
        searchedList={searchedList}
        handleUpArrow={handleUpArrow}
        handleDownArrow={handleDownArrow}
        handleClickSearchedItem={storeSearchedItem}
      />
    );
  };

  let queryTypes = [QUERY_TYPE.PROJECT];

  return (
    <div className='project-searcher' ref={searcherRef}>
      <SearchInput
        className="sea-qa-project-search-in-popover"
        onChange={startSearch}
        onClear={clearSearch}
        value={searchStr}
        autoFocus={true}
        placeholder={gettext('Search')}
      />
      <div className='search-type-wrapper'>
        <div className='search-type-content'>
          {queryTypes.map((queryType) => {
            return (
              <div
                key={queryType}
                className={classnames('sea-qa-search-type', `search-type-${queryType}`, {
                  active: queryType === currQueryType,
                })}
                onClick={() => onChangeQueryType(queryType)}
              >
                {gettext(QUERY_TYPE_DISPLAY[queryType])}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className='sea-qa-search-results'
        ref={searchListContainerRef}
      >
        {showRecent && renderRecentUsedResults()}
        {(mounted.current && !showRecent) && renderSearchedResults()}
      </div>
    </div>
  );
};

ProjectSearcher.propTypes = {
  onCloseSearcher: PropTypes.func,
  defaultQueryType: PropTypes.string,
};

export default ProjectSearcher;
