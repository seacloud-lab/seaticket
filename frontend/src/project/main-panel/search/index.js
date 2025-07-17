import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { toaster, SearchInput, EmptyTip, Icon, CenteredLoading } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import { gettext, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import Table from '../table';
import { TABLE_COLUMN_TYPE } from '../../constants';
import { SearchResult } from '../../models';

import './index.css';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Search = () => {
  const [value, setValue] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const source = useRef(null);
  const timer = useRef(null);

  const columns = useMemo(() => {
    return [
      { key: 'title', name: gettext('Title'), type: TABLE_COLUMN_TYPE.TEXT, width: '30%' },
      { key: 'url', name: gettext('URL'), type: TABLE_COLUMN_TYPE.URL, width: '30%' },
      { key: 'content', name: gettext('Content'), type: TABLE_COLUMN_TYPE.LONG_TEXT, width: '40%' },
    ];
  }, []);

  const onChange = useCallback((value = '') => {
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
      seaQAAPI.search(workspaceID, projectUuid, value, source.current.token).then(res => {
        const results = res.data?.results || [];
        setResults(results.map(r => new SearchResult(r)));
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

  return (
    <div className="sea-qa-project-search">
      <SearchInput
        className="mb-1"
        autoFocus={true}
        isClearable={true}
        wait={0}
        size={38}
        placeholder={gettext('Search')}
        onChange={onChange}
        onClear={onClear}
      />
      <div className="sea-qa-project-search-filter-wrapper">
        <div className="sea-qa-project-search-filter">
          <span className="sea-qa-project-search-filter-value">{gettext('Filter') + '1'}</span>
          <Icon symbol="down" />
        </div>
        <div className="sea-qa-project-search-filter">
          <span className="sea-qa-project-search-filter-value">{gettext('Filter') + '2'}</span>
          <Icon symbol="down" />
        </div>
        <div className="sea-qa-project-search-filter">
          <span className="sea-qa-project-search-filter-value">{gettext('Filter') + '3'}</span>
          <Icon symbol="down" />
        </div>
      </div>
      {searching ? (
        <CenteredLoading className="sea-qa-project-search-loading-tip" />
      ) : (
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
          {results.length > 0 && (
            <Table
              columns={columns}
              rows={results}
              className="p-0"
            />
          )}
        </>
      )}
    </div>
  );
};

export default Search;
