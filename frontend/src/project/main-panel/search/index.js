import React, { useCallback, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toaster, EmptyTip, CenteredLoading } from '@/components';
import GlobalSearchInput from '@/components/search-input/global-search-input';
import { searchAPI } from '../../api';
import { useConnections } from '../connections/hooks/connections';
import { gettext, mediaUrl } from '@/constants';
import { Utils } from '@/utils/utils';
import { SearchResult } from './models';
import TopBar from '../top-bar';
import ListItem from './list-item';
import HideConnectionSetter from './hide-connection-setter';
import FilterByDate from './filter-by-date';
import { SEARCH_FILTERS_KEY, SEARCH_FILTER_BY_DATE_TYPE_KEY, SEARCH_FILTER_BY_DATE_OPTION_KEY } from './constants';
import Switch from '@/components/switch';

import './index.css';
import './search-filters.css';

const { workspaceID, projectUuid } = window.app.pageOptions;

const SEARCH_STORE_KEY = 'search-project';

const Search = ({ title, settings }) => {
  const { connections, isConnectionsLoaded, isLoading, reloadConnections } = useConnections();
  const [value, setValue] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hiddenConnectionIDs, setHiddenConnectionIDs] = useState([]);
  const [filterDate, setFilterDate] = useState(
    {
      type: SEARCH_FILTER_BY_DATE_TYPE_KEY.LAST_UPDATED_TIME,
      value: '',
      from: null,
      to: null,
    },
  );

  const sourceRef = useRef(null);
  const timer = useRef(null);

  const [semanticEnabled, setSemanticEnabled] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('search-semantic-enabled') || 'false');
    } catch {
      return false;
    }
  });

  const onChange = useCallback((value = '', hiddenConnectionIDs, connections, filterDate) => {
    const hasSelectedConnections = Array.isArray(connections) && connections.some(c => !hiddenConnectionIDs.includes(c.id));
    const includeKBLocal = !hiddenConnectionIDs.includes('__kb__');
    const includeTicketLocal = !hiddenConnectionIDs.includes('__ticket__');
    if (!hasSelectedConnections && !includeKBLocal && !includeTicketLocal) {
      setValue(value);
      setResults([]);
      setSearching(false);
      if (sourceRef.current) {
        sourceRef.current.cancel('No sources selected');
      }
      timer.current && clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    const oldSearch = JSON.parse(window.localStorage.getItem(SEARCH_STORE_KEY) || '[]');
    if (!oldSearch.includes(value)) {
      oldSearch.push(value);
      window.localStorage.setItem(SEARCH_STORE_KEY, JSON.stringify(oldSearch));
    }
    setValue(value);
    setResults([]);
    setSearching(true);
    const cancelError = 'The current request has been automatically canceled';
    if (sourceRef.current) {
      sourceRef.current.cancel(cancelError);
    }
    timer.current && clearTimeout(timer.current);
    if (!value) {
      setSearching(false);
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      sourceRef.current = source;
      let timeFrom = null;
      let timeTo = null;
      if (filterDate && filterDate.value) {
        const isCustom = filterDate.value === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM;
        timeFrom = isCustom ? filterDate.from?.unix() : filterDate.from;
        timeTo = isCustom ? filterDate.to?.unix() : filterDate.to;
      }
      const showConnectionIds = connections.map(item => item.id).filter(i => !hiddenConnectionIDs.includes(i)).join(',');
      const extraSources = [...(includeKBLocal ? ['knowledge_base'] : []), ...(includeTicketLocal ? ['ticket'] : [])];
      searchAPI.search(workspaceID, projectUuid, value, showConnectionIds, timeFrom, timeTo, extraSources, source.token, semanticEnabled).then(res => {
        const rawResults = res.data?.results || [];
        setResults(rawResults.map(result => new SearchResult(result)));
        setSearching(false);
      }).catch(error => {
        if (!axios.isCancel(error)) {
          let errMessage = Utils.getErrorMsg(error);
          toaster.danger(errMessage);
          setSearching(false);
          return;
        }
        setSearching(error.message === cancelError);
      });
    }, 500);
  }, [semanticEnabled]);

  const onClear = useCallback(() => {
    setValue('');
    setResults([]);
    setSearching(false);
    setFilterDate({
      type: SEARCH_FILTER_BY_DATE_TYPE_KEY.LAST_UPDATED_TIME,
      value: '',
      from: null,
      to: null,
    });
    if (sourceRef.current) {
      sourceRef.current.cancel('The current request has been manually canceled');
    }
    timer.current && clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const toggleSemantic = useCallback((e) => {
    setSemanticEnabled(e.target.checked);
    window.localStorage.setItem('search-semantic-enabled', JSON.stringify(e.target.checked));
  }, []);

  useEffect(() => {
    reloadConnections();
    return () => {
      timer.current && clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (value) {
      onChange(value, hiddenConnectionIDs, connections, filterDate);
    }
  }, [semanticEnabled]);

  const handleConnectionIDsChange = useCallback((hiddenConnectionIDs) => {
    setHiddenConnectionIDs(hiddenConnectionIDs);
  }, []);

  const onFilterDateChange = useCallback((filterType, filterDate) => {
    if (filterType === SEARCH_FILTERS_KEY.DATE) {
      setFilterDate(filterDate);
    }
  }, []);

  if (!isConnectionsLoaded || (isLoading && connections.length === 0)) return null;

  return (
    <>
      <TopBar>
        <div className="w-100 text-truncate">{title}</div>
      </TopBar>
      <div className="sea-qa-project-search">
        <GlobalSearchInput
          className="mb-1"
          autoFocus={true}
          isClearable={true}
          size={38}
          placeholder={gettext('Search')}
          onChange={(value) => onChange(value, hiddenConnectionIDs, connections, filterDate)}
          onClear={onClear}
          storeKey={SEARCH_STORE_KEY}
        />
        <div className="search-filters-container" style={{ justifyContent: 'space-between' }}>
          <HideConnectionSetter onConnectionIDsChange={handleConnectionIDsChange} connections={connections} />
          <FilterByDate date={filterDate} onChange={onFilterDateChange} />
          <div className="search-filter ml-auto">
            <Switch
              checked={semanticEnabled}
              onChange={toggleSemantic}
              placeholder={gettext('Semantic search')}
              size="small"
              textPosition="right"
            />
          </div>
        </div>
        {searching ?
          <CenteredLoading className="sea-qa-project-search-loading-tip" />
          :
          <>
            {!value && (
              <div className="sea-qa-project-search-value-empty-tip">
                <EmptyTip src={`${mediaUrl}img/no-search-results-tip.png`} text={gettext('Please enter search keywords')} />
              </div>
            )}
            {value && results.length === 0 && (
              <div className="sea-qa-project-search-result-empty-tip">
                <EmptyTip src={`${mediaUrl}img/no-search-results-tip.png`} text={gettext('No results')} />
              </div>
            )}
            {value && results.length > 0 &&
              <div className="sea-qa-project-search-result-list">
                {results.map(result =>
                  <ListItem key={result._id || result.uuid} {...result} searchValue={value} settings={settings} />
                )}
              </div>
            }
          </>
        }
      </div>
    </>
  );
};

export default Search;
