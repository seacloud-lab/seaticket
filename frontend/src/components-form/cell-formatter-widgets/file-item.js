import React from 'react';
import PropTypes from 'prop-types';
import { getFileIconUrl } from '../utils/utils';

// need optimized
const { mediaUrl } = window.app.config;

const propTypes = {
  fileItem: PropTypes.object.isRequired,
};

class FileItem extends React.Component {

  onFileClick = () => {
    // todo
  };

  render() {
    let fileItem = this.props.fileItem;
    let fileIconUrl = getFileIconUrl(mediaUrl, fileItem.name, fileItem.type);
    return (
      <div className="file-item">
        <img alt='' src={fileIconUrl} onClick={this.onFileClick} title={fileItem.name} />
      </div>
    );
  }
}

FileItem.propTypes = propTypes;

export default FileItem;
