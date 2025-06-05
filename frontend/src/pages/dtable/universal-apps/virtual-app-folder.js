import React from 'react';
import PropTypes from 'prop-types';
import { folderImageSrc } from '../../../constants/image-source-constants';
import { gettext } from '../../../utils/constants';
import Rename from '../../../components/rename';

const propTypes = {
  onAddFolder: PropTypes.func,
  hideVirtualAppFolder: PropTypes.func,
};

function VirtualAppFolder({ onAddFolder, hideVirtualAppFolder }) {

  const addNewFolder = (newName) => {
    if (newName !== '') {
      onAddFolder(newName);
    }
    hideVirtualAppFolder();
  };

  const cancelAddFolder = (e) => {
    e && e.stopPropagation();
    hideVirtualAppFolder();
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

VirtualAppFolder.propTypes = propTypes;

export default VirtualAppFolder;
