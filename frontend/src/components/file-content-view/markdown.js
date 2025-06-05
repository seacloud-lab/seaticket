import React from 'react';
import { MarkdownViewer } from '@seafile/seafile-editor';

import '../../css/md-file-view.css';

const { fileContent } = window.app.pageOptions;

class FileContent extends React.Component {
  render() {
    return (
      <div className="file-view-content flex-1">
        <div className="md-content">
          <MarkdownViewer value={fileContent} />
        </div>
      </div>
    );
  }
}

export default FileContent;
