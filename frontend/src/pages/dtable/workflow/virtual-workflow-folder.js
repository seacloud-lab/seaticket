import React from 'react';
import PropTypes from 'prop-types';
import { folderImageSrc } from '../../../constants/image-source-constants';
import { gettext } from '../../../utils/constants';
import Rename from '../../../components/rename';

const propTypes = {
  onAddFolder: PropTypes.func,
  hideVirtualWorkflowFolder: PropTypes.func,
};

function VirtualWorkflowFolder({ onAddFolder, hideVirtualWorkflowFolder }) {

  const addNewFolder = (newName) => {
    if (newName !== '') {
      onAddFolder(newName);
    }
    hideVirtualWorkflowFolder();
  };

  const cancelAddFolder = (e) => {
    e && e.stopPropagation();
    hideVirtualWorkflowFolder();
  };

  const defaultFolderName = gettext('Untitled folder');

  return (
    <div className="rename-container d-flex align-items-center p-2 h-6">
      <div>
        <img className="mr-2" src={folderImageSrc} height="16px" alt='' />
      </div>
      <div className="table-name">
        <Rename
          name={defaultFolderName}
          onRenameConfirm={addNewFolder}
          onRenameCancel={cancelAddFolder}
        />
      </div>
    </div>
  );
}

VirtualWorkflowFolder.propTypes = propTypes;

export default VirtualWorkflowFolder;
