import React from 'react';
import PropTypes from 'prop-types';
import SearchResultItem from '../search-result-item';
import getWorkspaceName from '../../utils/get-workspace-name';

const SearchedBase = (props) => {
  const { searchedBase, selected } = props;
  const path = getWorkspaceName(searchedBase, []);
  const getClassName = `project-item ${selected ? 'project-item-selected' : ''}`;

  return (
    <SearchResultItem
      item={searchedBase}
      path={path}
      getClassName={getClassName}
      onItemClickHandler={props.clickSearchedBase.bind(this, searchedBase)}
    />
  );
};

SearchedBase.propTypes = {
  searchedBase: PropTypes.object,
  selected: PropTypes.bool,
  clickSearchedBase: PropTypes.func,
};

export default SearchedBase;
