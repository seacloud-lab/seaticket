import React, { useMemo, useState } from 'react';
import { KeyCodes } from '@/constants';
import { isModG, isModShiftG } from '@/utils/hotkey';
import SearcherInput from './searcher-input';
import { checkHasSearchResult } from '../../utils/search';
import { IconButton } from '@/components';

import './index.css';

const Searcher = ({ rowsCount, columnsCount, searchResult, searchCells, closeSearcher, focusNextMatchedCell, focusPreviousMatchedCell }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hasSearchValue, setHasSearchValue] = useState(false);

  const hasSearchResult = useMemo(() => {
    return checkHasSearchResult(searchResult);
  }, [searchResult]);

  const onToggleSearch = () => {
    setIsSearchActive(!isSearchActive);
  };

  const handleCloseSearcher = () => {
    setIsSearchActive(false);
    closeSearcher && closeSearcher();
  };

  const onKeyDown = (e) => {
    const isEmptySearchResult = !hasSearchResult;
    if (e.keyCode === KeyCodes.Escape) {
      e.preventDefault();
      handleCloseSearcher();
    } else if (isModG(e)) {
      e.preventDefault();
      if (isEmptySearchResult) return;
      focusNextMatchedCell && focusNextMatchedCell();
    } else if (isModShiftG(e)) {
      e.preventDefault();
      if (isEmptySearchResult) return;
      focusPreviousMatchedCell && focusPreviousMatchedCell();
    }
  };

  const renderSearchButtons = () => {
    return (
      <span className="sea-metadata-input-result-count">
        {hasSearchValue &&
          <span className="sea-metadata-input-result-description">
            {hasSearchResult ?
              (searchResult.currentSelectIndex + 1 + ' of ' + searchResult.matchedCells.length) : '0 of 0'
            }
          </span>
        }
        {hasSearchResult &&
          <>
            <IconButton icon="down" className="rotate-icon-180 ml-1" onClick={focusPreviousMatchedCell ? focusPreviousMatchedCell : () => {}} />
            <IconButton icon="down" onClick={focusNextMatchedCell ? focusNextMatchedCell : () => {}} />
          </>
        }
      </span>
    );
  };

  const size = 30;

  return (
    <div className="sea-metadata-searcher-container mr-2">
      {!isSearchActive && (
        <IconButton icon="search" onClick={onToggleSearch} />
      )}
      {isSearchActive && (
        <div
          className="sea-qa-search-input-wrapper display-search-icon display-clear-icon sea-metadata-search-input-wrapper"
          style={{ height: size }}
        >
          <IconButton icon="search" className="sea-qa-search-input-search" style={{ height: size, width: size }} />
          <SearcherInput
            rowsCount={rowsCount}
            columnsCount={columnsCount}
            onKeyDown={onKeyDown}
            setHasSearchValue={setHasSearchValue}
            searchCells={searchCells}
          />
          {renderSearchButtons()}
          <IconButton icon="x" className="sea-qa-search-input-clear" onClick={handleCloseSearcher} style={{ height: 20, width: 20, top: (size - 20) / 2, right: (size - 20) / 2 }} />
        </div>
      )}
    </div>
  );
};

export default Searcher;
