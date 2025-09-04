import React, { useCallback, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toaster, EmptyTip, CenteredLoading } from '../../../components';
import GlobalSearchInput from '../../../components/search-input/global-search-input';
import { searchAPI, connectionsAPI } from '../../api';
import { gettext, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { SearchResult } from './models';
import Connection from '../connections/models/connection';
import TopBar from '../top-bar';
import ListItem from './list-item';
import HideConnectionSetter from './hide-connection-setter';

import './index.css';
import './search-filters.css';

const { workspaceID, projectUuid } = window.app.pageOptions;

const SEARCH_STORE_KEY = 'search-project';

const Search = ({ title }) => {
  const [value, setValue] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hiddenConnectionIDs, setHiddenConnectionIDs] = useState([]);
  const [connections, setConnections] = useState([]);

  const sourceRef = useRef(null);
  const timer = useRef(null);

  const onChange = useCallback((value = '', hiddenConnectionIDs, connections) => {
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
      const showConnnectionIds = connections.map(item => item.id).filter(i => !hiddenConnectionIDs.includes(i)).join(',');
      searchAPI.search(workspaceID, projectUuid, value, showConnnectionIds, source.token).then(res => {
        const results = res.data?.results || [];
        setResults(results.map(result => new SearchResult(result)));
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
  }, []);

  const onClear = useCallback(() => {
    setValue('');
    setResults([]);
    setSearching(false);
    if (sourceRef.current) {
      sourceRef.current.cancel('The current request has been manually canceled');
    }
    timer.current && clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    connectionsAPI.listConnections(projectUuid, 1, 100).then(res => {
      setConnections(res.data.records.map(r => new Connection(r)));
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
    return () => {
      timer.current && clearTimeout(timer.current);
    };
  }, []);

  const handleConnectionIDsChange = useCallback((hiddenConnectionIDs) => {
    setHiddenConnectionIDs(hiddenConnectionIDs);
  }, []);

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
          onChange={(value) => onChange(value, hiddenConnectionIDs, connections)}
          onClear={onClear}
          storeKey={SEARCH_STORE_KEY}
        />
        <div className="search-filters-container">
          <HideConnectionSetter onConnectionIDsChange={handleConnectionIDsChange} connections={connections} />
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
                {results.map(result => <ListItem key={result.id || result.uuid} {...result} searchValue={value} />)}
              </div>
            }
          </>
        }
      </div>
    </>
  );
};

export default Search;
