import React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from 'reactstrap';
import FileViewTip from './components/file-view/file-view-tip';
import Audio from './components/file-content-view/audio';
import Image from './components/file-content-view/image';
import Markdown from './components/file-content-view/markdown';
import SVG from './components/file-content-view/svg';
import Text from './components/file-content-view/text';
import Video from './components/file-content-view/video';
import { dtableWebAPI } from './api/dtable-web-api';
import { gettext, mediaUrl, siteRoot } from './utils/constants';
import Loading from './components/loading';
import PDFViewer from './components/pdf-viewer';

import './css/shared-file-view.css';

const {
  fileType, err, fileName, downloadUrl, canDownload,
  repoID, filePath, commitID, hasOfficeConvertor
} = window.app.pageOptions;

class DocumentFileContent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: !err,
      errorMsg: ''
    };
    this.scriptNode = null;
  }

  componentDidMount() {
    if (err) {
      return;
    }

    let queryStatus = () => {
      dtableWebAPI.queryOfficeFileConvertStatus(repoID, commitID, filePath, fileType.toLowerCase()).then((res) => {
        const convertStatus = res.data['status'];
        switch (convertStatus) {
          case 'PROCESSING':
            this.setState({
              isLoading: true
            });
            setTimeout(queryStatus, 2000);
            break;
          case 'ERROR':
            this.setState({
              isLoading: false,
              errorMsg: gettext('Document conversion failed')
            });
            break;
          case 'DONE':
            this.setState({
              isLoading: false,
              errorMsg: ''
            });
            this.scriptNode = document.createElement('script');
            this.scriptNode.type = 'text/javascript';
            this.scriptNode.src = `${mediaUrl}js/pdf/viewer.js`;
            document.body.append(this.scriptNode);
            break;
          default:
            this.setState({
              isLoading: false,
              errorMsg: gettext('Document conversion failed')
            });
        }
      }).catch((error) => {
        if (error.response) {
          this.setState({
            isLoading: false,
            errorMsg: gettext('Document conversion failed')
          });
        } else {
          this.setState({
            isLoading: false,
            errorMsg: gettext('Please check the network.')
          });
        }
      });
    };

    queryStatus();
  }

  render() {
    const { isLoading, errorMsg } = this.state;
    if (err) {
      return <FileViewTip canDownload={canDownload} />;
    }

    if (isLoading) {
      return <Loading />;
    }

    if (errorMsg) {
      return <FileViewTip canDownload={canDownload} errorMsg={errorMsg} />;
    }

    return (
      <div className="file-view-content flex-1 pdf-file-view">
        <PDFViewer canDownload={canDownload} />
      </div>
    );
  }
}


class SpreadSheetFileContent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: !err,
      errorMsg: ''
    };
  }

  componentDidMount() {
    if (err) {
      return;
    }

    let queryStatus = () => {
      dtableWebAPI.queryOfficeFileConvertStatus(repoID, commitID, filePath, fileType.toLowerCase()).then((res) => {
        const convertStatus = res.data['status'];
        switch (convertStatus) {
          case 'QUEUED':
          case 'PROCESSING':
            this.setState({
              isLoading: true
            });
            setTimeout(queryStatus, 2000);
            break;
          case 'ERROR':
            this.setState({
              isLoading: false,
              errorMsg: gettext('Document conversion failed')
            });
            break;
          case 'DONE':
            this.setState({
              isLoading: false,
              errorMsg: ''
            });
            break;
          default:
            this.setState({
              isLoading: false,
              errorMsg: gettext('Document conversion failed')
            });
        }
      }).catch((error) => {
        if (error.response) {
          this.setState({
            isLoading: false,
            errorMsg: gettext('Document conversion failed')
          });
        } else {
          this.setState({
            isLoading: false,
            errorMsg: gettext('Please check the network.')
          });
        }
      });
    };
    queryStatus();
  }

  setIframeHeight = (e) => {
    const iframe = e.currentTarget;
    iframe.height = iframe.contentDocument.body.scrollHeight;
  };

  render() {
    const { isLoading, errorMsg } = this.state;
    if (err) {
      return <FileViewTip canDownload={canDownload} />;
    }
    if (isLoading) {
      return <Loading />;
    }
    if (errorMsg) {
      return <FileViewTip canDownload={canDownload} errorMsg={errorMsg} />;
    }
    return (
      <div className="file-view-content flex-1 spreadsheet-file-view">
        <iframe id="spreadsheet-container" title={fileName} src={`${siteRoot}office-convert/static/${repoID}/${commitID}${encodeURIComponent(filePath)}/index.html`} onLoad={this.setIframeHeight}></iframe>
      </div>
    );
  }
}


class DTableAssetFileView extends React.Component {

  onDownloadFile = () => {
    location.href = downloadUrl;
  };

  render() {
    let renderItem;

    if (err) {
      renderItem = <FileViewTip canDownload={canDownload} />;
    } else {
      const errorMsg = (<FileViewTip errorMsg={gettext('Online view is not applicable to this file format')} canDownload={canDownload} />);
      switch (fileType) {
        case 'Audio':
          renderItem = <Audio />;
          break;
        case 'Document':
          renderItem = hasOfficeConvertor ? <DocumentFileContent canDownload={canDownload} /> : <FileViewTip canDownload={canDownload} />;
          break;
        case 'SpreadSheet':
          renderItem = hasOfficeConvertor ? <SpreadSheetFileContent /> : <FileViewTip canDownload={canDownload} />;
          break;
        case 'Image':
          renderItem = <Image tip={errorMsg} canUseThumbnail={true} />;
          break;
        case 'Markdown':
          renderItem = <Markdown />;
          break;
        case 'SVG':
          renderItem = <SVG />;
          break;
        case 'Text':
          renderItem = <Text />;
          break;
        case 'Video':
          renderItem = <Video />;
          break;
        default:
          renderItem = errorMsg;
      }
    }

    if (fileType === 'PDF') {
      return (
        <PDFViewer canDownload={canDownload} />
      );
    }
    return (
      <div className="shared-file-view-md">
        <div className="dtable-asset-view-md-main">
          <div className="dtable-asset-view-head">
            <div className="dtable-asset-view-name">
              <h2 className="ellipsis" title={fileName}>{fileName}</h2>
            </div>
            {canDownload &&
              <Button color="secondary" onClick={this.onDownloadFile} title={gettext('Download')} aria-label={gettext('Download')}>
                <i className="dtable-font dtable-icon-download" aria-hidden="true"></i>
              </Button>
            }
          </div>
          <div className="dtable-asset-view-body">
            {renderItem}
          </div>
        </div>
      </div>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(<DTableAssetFileView />);
