import React, { useCallback, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toaster, EmptyTip, CenteredLoading } from '../../../components';
import GlobalSearchInput from '../../../components/search-input/global-search-input';
import { seaQAAPI } from '../../../api/web-api';
import { gettext, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { SearchResult } from '../../models';
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
  const [connectionTypes, setConnectionTypes] = useState([]);

  const source = useRef(null);
  const timer = useRef(null);

  const onChange = useCallback((value = '', connectionTypes) => {
    const oldSearch = JSON.parse(window.localStorage.getItem(SEARCH_STORE_KEY) || '[]');
    if (!oldSearch.includes(value)) {
      oldSearch.push(value);
      window.localStorage.setItem(SEARCH_STORE_KEY, JSON.stringify(oldSearch));
    }
    setValue(value);
    setResults([]);
    setSearching(true);
    const cancelError = 'The current request has been automatically canceled';
    if (source.current) {
      source.current.cancel(cancelError);
    }
    timer.current && clearTimeout(timer.current);
    if (!value) {
      setSearching(false);
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      source.current = seaQAAPI.getSource();
      seaQAAPI.search(workspaceID, projectUuid, value, connectionTypes.join(','), source.current.token).then(res => {
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
    if (source.current) {
      source.current.cancel('The current request has been manually canceled');
    }
    timer.current && clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    return () => {
      timer.current && clearTimeout(timer.current);
    };
  }, []);

  const handleConnectionTypesChange = useCallback((newConnectionTypes) => {
    setConnectionTypes(newConnectionTypes);
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
          onChange={(value) => onChange(value, connectionTypes)}
          onClear={onClear}
          storeKey={SEARCH_STORE_KEY}
        />
        <div className="search-filters-container">
          <HideConnectionSetter onConnectionTypesChange={handleConnectionTypesChange} />
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
                {results.map(result => <ListItem {...result} />)}
              </div>
            }
          </>
        }
      </div>
    </>
  );
};

export default Search;
