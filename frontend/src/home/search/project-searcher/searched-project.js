import React from 'react';
import PropTypes from 'prop-types';
import getWorkspaceName from '../../utils/get-workspace-name';
import SearchResultItem from '../search-result-item';

const SearchedProject = (props) => {
  const { project, selected } = props;
  const path = getWorkspaceName(project, []);

  return (
    <SearchResultItem
      item={project}
      path={path}
      className={`project-item ${selected ? 'project-item-selected' : ''}`}
      onItemClickHandler={props.clickSearched.bind(this, project)}
    />
  );
};

SearchedProject.propTypes = {
  project: PropTypes.object,
  selected: PropTypes.bool,
  clickSearched: PropTypes.func,
};

export default SearchedProject;
