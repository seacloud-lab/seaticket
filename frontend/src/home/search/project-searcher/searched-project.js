import React from 'react';
import PropTypes from 'prop-types';
import SearchResultItem from '../search-result-item';
import getWorkspaceName from '../../utils/get-workspace-name';

const SearchedProject = (props) => {
  const { project, selected } = props;
  const path = getWorkspaceName(project, []);
  const getClassName = `project-item ${selected ? 'project-item-selected' : ''}`;

  return (
    <SearchResultItem
      item={project}
      path={path}
      getClassName={getClassName}
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
