import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { getValueLength } from '../search-utils';
import { Utils } from '../../../../utils/utils';

const gettext = window.gettext;

const SearcherInput = (props) => {
  const [isChineseInput, setIsChineseInput] = useState(false);
  const mounted = useRef(false);
  const inputRef = useRef(null);
  let inputValueRef = useRef('');
  let inputTimerRef = useRef(null);

  const clearInputTimer = () => {
    const inputTimer = inputTimerRef.current;
    if (!inputTimer) {
      return;
    }
    clearTimeout(inputTimer);
    inputTimerRef.current = null;
  };

  const onInputChange = (event) => {
    const newSearchStr = event.target.value;
    props.setSearchStr(newSearchStr);

    const trimmedNewSearchStr = newSearchStr.trim();
    let inputValue = inputValueRef.current;
    if (inputValue === trimmedNewSearchStr) {
      return;
    }

    inputValue = trimmedNewSearchStr;
    inputValueRef.current = inputValue;

    // not search: search string is too short
    if (isChineseInput || !inputValue || getValueLength(inputValue) < 3) {
      props.stopSearch();
      clearInputTimer();
    } else {
      clearInputTimer();
      inputTimerRef.current = setTimeout(() => {
        props.startSearch(inputValue);
      }, 500);
    }
  };

  const onClearSearch = () => {
    inputValueRef.current = '';
    props.setSearchStr('');
    props.stopSearch();
  };

  const onCloseDtableSearcher = (event) => {
    event.stopPropagation();
    props.onCloseDtableSearcher();
  };

  const onDocumentKeydown = (event) => {
    const isModF = isHotkey('mod+f');
    if (isModF(event)) {
      event.preventDefault();
      inputRef && inputRef.current.focus();
    }
    if (event.keyCode === Utils.keyCodes.esc) {
      onCloseDtableSearcher(event);
    }
  };

  const onCompositionStart = () => {
    setIsChineseInput(true);
  };

  const onCompositionEnd = () => {
    // chrome：compositionstart -> onChange -> compositionend
    // not chrome：compositionstart -> compositionend -> onChange
    // The onChange event will setState and change input value, then setTimeout to initiate the search
    setTimeout(() => {
      const inputValue = inputValueRef.current;
      if (inputValue && getValueLength(inputValue) >= 3) {
        props.startSearch(inputValue);
      }
      setIsChineseInput(false);
    }, 1);
  };

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      document.addEventListener('keydown', onDocumentKeydown, true);
    }
    return () => {
      clearInputTimer();
      document.removeEventListener('keydown', onDocumentKeydown, true);
    };
  }, []);

  return (
    <div className='dtable-searcher-input'>
      <div className='input-icon'>
        <i className='search-icon-left input-icon-addon dtable-font dtable-icon-search'></i>
        <input
          autoFocus
          ref={inputRef}
          type='text'
          className='form-control search-input'
          name='query'
          placeholder={gettext('Search')}
          autoComplete='off'
          value={props.searchStr}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onChange={onInputChange}
          aria-label={gettext('Search')}
        />
        <span className="btn-clear-searcher" onClick={onClearSearch}>
          <i className="dtable-font dtable-icon-x"></i>
        </span>
      </div>
    </div>
  );
};

SearcherInput.propTypes = {
  stopSearch: PropTypes.func,
  startSearch: PropTypes.func,
  onCloseDtableSearcher: PropTypes.func,
  searchStr: PropTypes.string,
  setSearchStr: PropTypes.func,
};

SearcherInput.displayName = 'SearcherInput';

export default SearcherInput;
