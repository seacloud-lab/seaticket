import React, { useCallback, useState } from 'react';
import { KeyCodes } from '@/constants';
import { IconButton } from '@/components';
import { SearchInput } from '@/components';

import './index.css';

const Searcher = ({ onChange }) => {
  const [isSearchActive, setIsSearchActive] = useState(false);

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

  return (
    <div className="sea-metadata-searcher-container mr-2">
      {!isSearchActive && (
        <IconButton icon="search" onClick={onToggleSearch} />
      )}
      {isSearchActive && (
        <SearchInput
          autoFocus={true}
          size={30}
          onKeyDown={onKeyDown}
          onClear={onClear}
          onChange={onChange}
        />
      )}
    </div>
  );
};

export default Searcher;
