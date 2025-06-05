import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  title: PropTypes.string,
  folder: PropTypes.object,
  onChangeCurrentFolder: PropTypes.func,
};

function AppFolderPath({ folder, title, onChangeCurrentFolder }) {

  function handleClick() {
    onChangeCurrentFolder(null);
  }

  return (
    <div className="folder-items-dialog-dirpath">
      <span className="path-link" onClick={handleClick}>{title}</span>
      {folder &&
        <>
          <span className="path-split">/</span>
          <span>{folder.name}</span>
        </>
      }
    </div>
  );
}

AppFolderPath.propTypes = propTypes;

export default AppFolderPath;
