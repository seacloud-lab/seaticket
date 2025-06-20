import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../constants';

const { err, fileType, downloadUrl } = window.app.pageOptions;

const propTypes = {
  canDownload: PropTypes.bool,
  errorMsg: PropTypes.string
};

class FileViewTip extends React.Component {

  render() {
    let errorMsg;
    let style = {};
    const { canDownload } = this.props;
    if (!canDownload) {
      style = { color: 'gray', pointerEvents: 'none' };
    }
    if (err === 'File preview unsupported') {
      errorMsg = <p>{gettext('Online view is not applicable to this file format')}</p>;
    } else {
      errorMsg = <p>{err || this.props.errorMsg}</p>;
    }

    return (
      <div className="file-view-content flex-1 o-auto">
        <div className="file-view-tip">
          {fileType !== 'Document' && errorMsg}
          <a href={downloadUrl} style={style} className="btn btn-secondary">{gettext('Download')}</a>
        </div>
      </div>
    );
  }
}

FileViewTip.propTypes = propTypes;

FileViewTip.defaultProps = {
  canDownload: true
};

export default FileViewTip;
