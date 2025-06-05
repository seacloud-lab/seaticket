import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AppFolder from './app-folder.js';
import VirtualAppFolder from '../../virtual-app-folder.js';
import { gettext } from '../../../../../utils/constants.js';

const propTypes = {
  currentFolder: PropTypes.object,
  folders: PropTypes.array,
  title: PropTypes.string,
  onAddFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
};

function AppFolders({ currentFolder, folders, title, onAddFolder, onDeleteFolder, onRenameFolder, onChangeCurrentFolder }) {
  const [isShowFolder, setIsShowFolder] = useState(false);

  const showVirtualAppFolder = () => {
    setIsShowFolder(true);
  };

  const hideVirtualAppFolder = () => {
    setIsShowFolder(false);
  };

  return (
    <div className="app-folder-tree d-flex flex-column" style={{ maxHeight: window.innerHeight - 140 }}>
      <span className="folder-tree-title mb-1">{title}</span>
      {folders.map((folder) => {
        const isActive = folder.id === (currentFolder && currentFolder.id) ? true : false;
        return (
          <AppFolder
            key={`app-folder-item-${folder.id}`}
            folder={folder}
            isActive={isActive}
            onDeleteFolder={onDeleteFolder}
            onRenameFolder={onRenameFolder}
            onChangeCurrentFolder={onChangeCurrentFolder}
          />
        );
      })}
      {isShowFolder && (
        <VirtualAppFolder
          onAddFolder={onAddFolder}
          hideVirtualAppFolder={hideVirtualAppFolder}
        />
      )}
      <div className="add-new-app-folder my-2" onClick={showVirtualAppFolder}>
        <span className="dtable-font dtable-icon-enlarge mr-2" />
        <span>{gettext('New folder')}</span>
      </div>
    </div>
  );
}

AppFolders.propTypes = propTypes;

export default AppFolders;
