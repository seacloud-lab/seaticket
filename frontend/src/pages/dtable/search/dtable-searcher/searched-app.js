import React, { forwardRef, useRef } from 'react';
import PropTypes from 'prop-types';
import AppItem from '../../universal-apps/app-item';

const SearchedApp = forwardRef(function SearchedApp(props, ref) {
  const { searchedApp, selected } = props;

  const appItemRef = useRef(null);

  if (ref) {
    if (!ref.current) {
      ref.current = {};
    }
    ref.current.appItemRef = appItemRef;
  }

  const className = `search-app-item ${selected ? 'app-item-selected' : ''}`;
  return (
    <AppItem
      isAdmin
      ref={ref => appItemRef.current = ref}
      appItem={searchedApp}
      className={className}
      onItemClickHandler={props.clickSearchedApp.bind(this, searchedApp)}
    />
  );
});

SearchedApp.propTypes = {
  searchedApp: PropTypes.object,
  selected: PropTypes.bool,
  clickSearchedApp: PropTypes.func,
};

SearchedApp.displayName = 'SearchedApp';

export default SearchedApp;
