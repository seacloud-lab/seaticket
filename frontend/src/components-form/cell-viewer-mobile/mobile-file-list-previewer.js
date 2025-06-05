import React from 'react';
import PropTypes from 'prop-types';
import { ActionSheet, Icon } from 'antd-mobile';
import { Utils } from '../../utils/utils';
import { gettext } from '../../utils/constants';
import { getFileIconUrl } from '../utils/utils';
import CommonAddTool from '../../components/common-add-tool';

const { mediaUrl } = window.app.config;

const propTypes = {
  value: PropTypes.array,
  togglePreviewer: PropTypes.func,
  deleteFile: PropTypes.func,
  onRenameItem: PropTypes.func,
  resetFileValue: PropTypes.func.isRequired,
};

class MobileFileListPreviewer extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: props.value,
    };
  }

  togglePreviewer = () => {
    this.props.togglePreviewer('addition');
    this.props.resetFileValue();
  };

  render() {
    const { value, deleteFile } = this.props;
    return (
      <div className="file-previewer-container">
        {value.length > 0 &&
          <div className="file-previewer-wrapper">
            {value.map((item, index) => {
              return <FileListItem key={index} fileItem={item} deleteFile={deleteFile} itemIndex={index} />;
            })}
          </div>
        }
        {value.length > 0 && 
          <div className="view-partition view-partition-border-top"></div>
        }
        <CommonAddTool className="mobile-add-btn" callBack={this.togglePreviewer} footerName={gettext('Add files')}/>
      </div>
    );
  }
}

MobileFileListPreviewer.propTypes = propTypes;

const FileListItemPropTypes = {
  fileItem: PropTypes.object.isRequired,
  deleteFile: PropTypes.func.isRequired,
  itemIndex: PropTypes.number
};

class FileListItem extends React.Component {

  constructor(props) {
    super(props);
  }

  showActionSheet = (e) => {
    e && e.stopPropagation();
    let buttons = [(<div className="my-am-action"><i className="dtable-font dtable-icon-delete"></i>{gettext('Delete')}</div>)];
    ActionSheet.showActionSheetWithOptions({
      className: 'dtable-antd-mobile',
      options: buttons,
      maskClosable: true
    }, (buttonIndex) => {
      if (buttonIndex === 0) {
        this.props.deleteFile(this.props.itemIndex);
      }
    });
  }

  render() {
    const { fileItem } = this.props;
    let fileIconUrl = getFileIconUrl(mediaUrl ,fileItem.name, fileItem.direntType);
    return (
      <div className="file-previewer-box">
        <div className="file-previewer-item">
          <div className="file-previewer-icon">
            <img src={fileIconUrl} alt="file-previewer"/>
          </div>
          <div className="file-previewer-info">
            <div className={`file-previewer-item-name ${fileItem.type === 'dir' ? 'file-previewer-item-name-height' : ''}`} >
              <span>{fileItem.name}</span>
            </div>
            {fileItem.size && <div className="file-previewer-item-size">{Utils.bytesToSize(fileItem.size)}</div>}
          </div>
        </div>
        <div className="file-previewer-operation" onClick={this.showActionSheet}>
          <Icon type="ellipsis" size="xs"/>
        </div>
      </div>
    );
  }
}

FileListItem.propTypes = FileListItemPropTypes;

export default MobileFileListPreviewer;
