import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gettext, KeyCodes } from '@/constants';
import { IconButton } from '@/components';
import { SearchInput } from '@/components';
import { EVENT_BUS_TYPE } from '../../constants';
import context from '../../context';

import './index.css';

const Searcher = ({ onChange }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef(null);

  const onToggleSearch = useCallback(() => {
    setIsSearchActive(!isSearchActive);
  }, []);

  const onClear = useCallback(() => {
    setIsSearchActive(false);
    onChange && onChange('');
  }, [onChange]);

  const onKeyDown = useCallback((e) => {
    if (e.keyCode === KeyCodes.Escape) {
      e.preventDefault();
      onClear();
    }
  }, [onClear]);

  const onReSearch = useCallback(() => {
    if (!isSearchActive || !searchInputRef.current) return;
    const searchValue = searchInputRef.current.getSearchValue();
    onChange && onChange(searchValue);
  }, [isSearchActive, onChange]);

  useEffect(() => {
    const unsubscribeStartSearch = context.eventBus.subscribe(EVENT_BUS_TYPE.START_SEARCH_ROWS, () => {
      setIsSearchActive(true);
    });
    const unsubscribeClearSearch = context.eventBus.subscribe(EVENT_BUS_TYPE.CLEAR_SEARCH_ROWS, onClear);
    const unsubscribeReSearch = context.eventBus.subscribe(EVENT_BUS_TYPE.RE_SEARCH_ROWS, onReSearch);
    return () => {
      unsubscribeStartSearch();
      unsubscribeClearSearch();
      unsubscribeReSearch();
    };
  }, [onClear, onReSearch]);

  return (
    <div className="sea-metadata-searcher-container mr-2">
      {!isSearchActive &&
        <IconButton
          icon="search"
          onClick={onToggleSearch}
          title={gettext('Search')}
          aria-label={gettext('Search')}
        />
      }
      {isSearchActive && (
        <SearchInput
          ref={searchInputRef}
          className="sea-metadata-search-input-wrapper"
          autoFocus={true}
          isShowClearIcon={true}
          size={30}
          placeholder={gettext('Search')}
          onKeyDown={onKeyDown}
          onClear={onClear}
          onChange={onChange}
        />
      )}
    </div>
  );
};

export default Searcher;
