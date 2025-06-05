import React, { Component } from 'react';
import PropTypes from 'prop-types';

import './folder-items-dialog-file-path.css';

export default class FolderItemsDialogFilePath extends Component {

  static propTypes = {
    folder: PropTypes.object,
    changeCurrentFolder: PropTypes.func.isRequired,
    workspace: PropTypes.object,
  };

  onClick = () => {
    this.props.changeCurrentFolder(null);
  };

  renderWorkspaceName = () => {
    const { workspace } = this.props;
    // in default folder
    if (workspace) {
      const { type, name } = workspace;
      return (
        <span className="path-link" onClick={this.onClick}>
          {type === 'personal' ? window.gettext('My bases') : name}
        </span>
      );
    }
    // in share with me folder
    else {
      return (
        <span className="path-link" onClick={this.onClick}>
          {window.gettext('Shared with me')}
        </span>
      );
    }
  };

  render() {
    const { folder } = this.props;
    return (
      <div className="folder-items-dialog-dirpath">
        {this.renderWorkspaceName()}
        {folder &&
          <>
            <span className="path-split">/</span>
            <span>{folder.name}</span>
          </>
        }
      </div>
    );
  }
}
