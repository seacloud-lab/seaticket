import React, { forwardRef, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import SearchedBase from './searched-base';
import { Utils } from '../../../utils/utils';
import { QUERY_TYPE } from './constant';

const siteRoot = window.app.config.siteRoot;

const openBaseOnBlankWindow = (searchedBase) => {
  const { workspace_id, name, share_type, share_id } = searchedBase;
  let href;
  if (share_type === 'user-view-share') {
    href = siteRoot + 'dtable-shared-view/personal/' + share_id + '/';
  } else if (share_type === 'group-view-share') {
    href = siteRoot + 'dtable-shared-view/group/' + share_id + '/';
  } else {
    href = siteRoot + 'workspace/' + workspace_id + '/dtable/' + name + '/';
  }
  window.open(href, '_blank');
};

const SearchedList = forwardRef(function SearchedList(props, ref) {
  const { searchedList } = props;

  const [highlightIndex, setHighlightIndex] = useState(0);

  const mounted = useRef(false);
  const searchedListRef = useRef(null);

  const clickSearchedBase = (searchedBase) => {
    props.handleClickSearchedItem(searchedBase);
    openBaseOnBlankWindow(searchedBase);
  };

  if (ref) {
    if (!ref.current) {
      ref.current = {};
    }
  }

  const onEnter = (event) => {
    event.stopPropagation();
    const searchedItem = Array.isArray(searchedList) && searchedList[highlightIndex];
    if (!searchedItem) {
      return;
    }

    props.handleClickSearchedItem(searchedItem);
    switch (searchedItem.query_type) {
      case QUERY_TYPE.BASE: {
        const searchedBase = searchedList[highlightIndex];
        clickSearchedBase(searchedBase);
        break;
      }
      default: {
        break;
      }
    }
  };

  const onUpArrow = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextHighlightIndex = highlightIndex > 0 ? highlightIndex - 1 : 0;
    setHighlightIndex(nextHighlightIndex);

    // update scrollTop
    props.handleUpArrow(nextHighlightIndex, searchedList.length);
  };

  const onDownArrow = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const maxIndex = searchedList.length - 1;
    const nextHighlightIndex = highlightIndex < maxIndex ? highlightIndex + 1 : maxIndex;
    setHighlightIndex(nextHighlightIndex);

    // update scrollTop
    props.handleDownArrow(nextHighlightIndex);
  };

  const onHotKey = (event) => {
    const keyCode = event.keyCode;
    if (
      keyCode === Utils.keyCodes.enter
      && (Array.isArray(searchedList) && searchedList.length > 0)
    ) {
      onEnter(event);
    } else if (keyCode === Utils.keyCodes.up) {
      onUpArrow(event);
    } else if (keyCode === Utils.keyCodes.down) {
      onDownArrow(event);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
    // get latest highlight index: need re-register hot key while highlight index or query type changed
  }, [highlightIndex, searchedList]);

  useEffect(() => {
    // init highlight index while query type is changed
    if (mounted.current) {
      setHighlightIndex(0);
    } else {
      mounted.current = true;
    }
  }, [searchedList]);

  return (
    <ul className='search-result-list' ref={searchedListRef}>
      {Array.isArray(searchedList) && searchedList.map((searchedItem, index) => {
        const { query_type } = searchedItem;
        const selected = highlightIndex === index;
        switch (query_type) {
          case QUERY_TYPE.BASE: {
            return (
              <SearchedBase
                key={`${query_type}-${searchedItem.id}-${index}`}
                searchedBase={searchedItem}
                selected={selected}
                clickSearchedBase={clickSearchedBase}
              />
            );
          }
          default: {
            return null;
          }
        }
      })}
    </ul>
  );
});

SearchedList.propTypes = {
  searchedList: PropTypes.array,
  handleUpArrow: PropTypes.func,
  handleDownArrow: PropTypes.func,
  handleClickSearchedItem: PropTypes.func,
};

SearchedList.displayName = 'SearchedList';

export default SearchedList;
