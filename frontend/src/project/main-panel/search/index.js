import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { toaster, SearchInput, EmptyTip, Icon, CenteredLoading } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import { gettext, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import Table from '../table';
import { TABLE_COLUMN_TYPE } from '../../constants';
import { SearchResults } from '../../models';
import TopBar from '../top-bar';

import './index.css';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Search = ({ title }) => {
  const [value, setValue] = useState('');
  const [results, setResults] = useState(SearchResults({}));
  const [searching, setSearching] = useState(false);

  const source = useRef(null);
  const timer = useRef(null);

  const siteColumns = useMemo(() => {

    return [
      { key: 'title', name: gettext('Title'), type: TABLE_COLUMN_TYPE.TEXT, width: '30%' },
      { key: 'url', name: gettext('URL'), type: TABLE_COLUMN_TYPE.URL, width: '30%' },
      { key: 'content', name: gettext('Content'), type: TABLE_COLUMN_TYPE.LONG_TEXT, width: '40%' },
    ];
  }, []);

  const seafileColumns = useMemo(() => {
    return [
      { key: 'filename', name: gettext('Filename'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%' },
      { key: 'path', name: gettext('Path'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%' },
      { key: 'repo_id', name: gettext('Repo_id'), type: TABLE_COLUMN_TYPE.TEXT, width: '20%' },
      { key: 'content', name: gettext('Content'), type: TABLE_COLUMN_TYPE.LONG_TEXT, width: '40%' },
    ];
  }, []);

  const onChange = useCallback((value = '') => {
    setValue(value);
    setResults(SearchResults({}));
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
        const results = res.data?.results || {};
        setResults(SearchResults(results));
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
    <>
      <TopBar><div className="w-100 text-truncate">{title}</div></TopBar>
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
            {value && results.site_list.length === 0 && (
              <div className="sea-qa-project-search-result-empty-tip">
                <EmptyTip src={`${mediaUrl}img/no-search-results-tip.png`} text={gettext('No results')} />
              </div>
            )}
            {results.site_list.length > 0 && (
              <Table
                columns={siteColumns}
                rows={results.site_list}
                className="p-0"
              />
            )}

            {value && results.seafile_list.length === 0 && (
              <div className="sea-qa-project-search-result-empty-tip">
                <EmptyTip src={`${mediaUrl}img/no-search-results-tip.png`} text={gettext('No results')} />
              </div>
            )}
            {results.seafile_list.length > 0 && (
              <Table
                columns={seafileColumns}
                rows={results.seafile_list}
                className="p-0"
              />
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Search;
