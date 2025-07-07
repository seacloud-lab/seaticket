import React, { useCallback, useState } from 'react';
import { Alert } from 'reactstrap';
import toaster from '../../../components/toaster';
import { seaQAAPI } from '../../../api/web-api';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';

const {
  workspaceID, projectUuid
} = window.app.pageOptions;

const Search = () => {
  const [searchResult, setSearchResult] = useState([]);
  const [queryStr, setQueryStr] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const search = useCallback(() => {
    if (!queryStr) {
      setErrorMsg(gettext('query is required'));
      return;
    }
    seaQAAPI.search(workspaceID, projectUuid, queryStr).then(res => {
      const results = res.data.results;
      setSearchResult(results);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
    });
  }, [queryStr, searchResult]);


  const onChangeHandler = useCallback((event) => {
    let inputValue = event.target.value;
    setQueryStr(inputValue);
  }, [queryStr]);

  return (
    <>
      <div>
        <input
          type="text"
          onChange={onChangeHandler}
        />
        <button
          onClick={search}
        >
          {gettext('search')}
        </button>
        {errorMsg && (<Alert color="danger">{errorMsg}</Alert>)}

        <div>
          <table>
            <thead>
              <tr>
                <th width="15%">{gettext('title')}</th>
                <th width="10%">{gettext('url')}</th>
                <th width="20%">{gettext('content')}</th>
              </tr>
            </thead>
            {searchResult.map(row => {
              return (
                <tr>
                  <td>{row.title}</td>
                  <td>{row.url}</td>
                  <td>{row.content.slice(0, 30)}</td>
                </tr>
              );
            })}
          </table>
        </div>
      </div>
    </>
  );
};

export default Search;
