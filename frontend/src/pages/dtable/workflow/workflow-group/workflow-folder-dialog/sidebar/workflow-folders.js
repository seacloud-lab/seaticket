import React, { useState } from 'react';
import PropTypes from 'prop-types';
import WorkflowFolder from './workflow-folder';
import VirtualWorkflowFolder from '../../../virtual-workflow-folder';
import { gettext } from '../../../../../../utils/constants';

const propTypes = {
  currentFolder: PropTypes.object,
  folders: PropTypes.array,
  title: PropTypes.string,
  onAddFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
};

function WorkflowFolders({ currentFolder, folders, title, onAddFolder, onDeleteFolder, onRenameFolder, onChangeCurrentFolder }) {
  const [isShowFolder, setIsShowFolder] = useState(false);

  const showVirtualWorkflowFolder = () => {
    setIsShowFolder(true);
  };

  const hideVirtualWorkflowFolder = () => {
    setIsShowFolder(false);
  };

  return (
    <div className="workflow-folder-tree d-flex flex-column" style={{ maxHeight: window.innerHeight - 140 }}>
      <span className="folder-tree-title mb-1">{title}</span>
      {folders.map((folder) => {
        const isActive = folder.id === (currentFolder && currentFolder.id) ? true : false;
        return (
          <WorkflowFolder
            key={`workflow-folder-item-${folder.id}`}
            folder={folder}
            folders={folders}
            isActive={isActive}
            onDeleteFolder={onDeleteFolder}
            onRenameFolder={onRenameFolder}
            onChangeCurrentFolder={onChangeCurrentFolder}
          />
        );
      })}
      {isShowFolder && (
        <VirtualWorkflowFolder
          onAddFolder={onAddFolder}
          hideVirtualWorkflowFolder={hideVirtualWorkflowFolder}
        />
      )}
      <div className="add-new-workflow-folder my-2" onClick={showVirtualWorkflowFolder}>
        <span className="dtable-font dtable-icon-enlarge mr-2" />
        <span>{gettext('New folder')}</span>
      </div>
    </div>
  );
}

WorkflowFolders.propTypes = propTypes;

export default WorkflowFolders;
