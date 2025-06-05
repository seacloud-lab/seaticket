import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'reactstrap';
import ModalPortal from '../../../components/modal-portal';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';

import './image-item.css';

class ImageItem extends React.Component {

  static defaultProps = {
    disableTooltip: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      isTooltipOpen: false,
      showTip: false,
    };
    this.isDesktop = Utils.isDesktop();
  }

  toggle = () => {
    this.setState({ isTooltipOpen: !this.state.isTooltipOpen });
  };

  onClickDelete = (e) => {
    if (this.isDesktop) {
      e.stopPropagation();
      this.position = {
        top: e.clientY,
        left: e.clientX,
      };
      this.setState({ showTip: true });
    } else {
      this.deleteImage(e);
    }
  };

  closeTip = () => {
    this.setState({ showTip: false });
  };

  deleteImage = (e) => {
    e.stopPropagation();
    if (this.props.deleteImage && this.props.index > -1) {
      this.props.deleteImage(this.props.index);
    }
    this.closeTip();
  };

  openFile = (e) => {
    e.stopPropagation();
    const { openFile, url } = this.props;
    if (openFile && url) {
      openFile(url);
    }
  };

  downloadFile = (e) => {
    e.stopPropagation();
    const { downloadFile, url } = this.props;
    if (downloadFile && url) {
      downloadFile(url);
    }
  };

  render() {
    let { src, name, targetId, showDeleteIcon, showViewIcon, showDownloadIcon, deleteTip, disableTooltip } = this.props;
    return (
      <>
        <img alt="" src={src} />
        {!disableTooltip && (
          <Tooltip
            placement="bottom"
            isOpen={this.state.isTooltipOpen}
            toggle={this.toggle}
            target={targetId}
            delay={{ show: 0, hide: 0 }}
            fade={false}
          >
            {name}
          </Tooltip>
        )}
        <div className="editor-icons-container">
          {showDeleteIcon && (
            <span className="editor-delete-icon" onClick={this.onClickDelete}>
              <i className="dtable-font dtable-icon-fork-number" />
            </span>
          )}
          {showViewIcon && !this.isDesktop && (
            <span
              className="editor-view-icon d-flex align-items-center justify-content-center"
              onClick={this.openFile}
            >
              <i className="dtable-font dtable-icon-eye" />
            </span>
          )}
          {showDownloadIcon && (
            <span className="editor-download-icon" onClick={this.downloadFile}>
              <i className="dtable-font dtable-icon-download" />
            </span>
          )}
        </div>
        {this.isDesktop && this.state.showTip && (
          <DeleteTip
            position={this.position}
            toggle={this.closeTip}
            deleteImage={this.deleteImage}
            deleteTip={deleteTip}
          />
        )}
      </>
    );
  }
}

ImageItem.propTypes = {
  src: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  targetId: PropTypes.string.isRequired,
  url: PropTypes.string,
  showDeleteIcon: PropTypes.bool,
  showViewIcon: PropTypes.bool,
  showDownloadIcon: PropTypes.bool,
  deleteImage: PropTypes.func,
  openFile: PropTypes.func,
  downloadFile: PropTypes.func,
  index: PropTypes.number,
  deleteTip: PropTypes.string,
  disableTooltip: PropTypes.bool,
};

class DeleteTip extends React.Component {

  componentDidMount() {
    document.addEventListener('click', this.handleOutsideClick);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
  }

  handleOutsideClick = (e) => {
    if (this.tipContainer && !this.tipContainer.contains(e.target)) {
      this.props.toggle();
    }
  };

  onMouseEnter = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  cancelDeleteOperation = (e) => {
    e.stopPropagation();
    this.props.toggle();
  };

  render() {
    const { deleteImage, position, deleteTip } = this.props;
    return (
      <ModalPortal>
        <div
          ref={(node) => this.tipContainer = node}
          className="dtable-tip tip-container"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={this.onMouseEnter}
        >
          <b className="mb-4">{deleteTip || gettext('Are you sure you want to delete this image?')}</b>
          <div className="d-flex justify-content-end">
            <button className="btn btn-secondary mr-2" onClick={this.cancelDeleteOperation}>{gettext('Cancel')}</button>
            <button className="btn btn-primary" onClick={deleteImage}>{gettext('Delete')}</button>
          </div>
        </div>
      </ModalPortal>
    );
  }
}

DeleteTip.propTypes = {
  position: PropTypes.object.isRequired,
  deleteImage: PropTypes.func.isRequired,
  toggle: PropTypes.func.isRequired,
  deleteTip: PropTypes.string,
};

export default ImageItem;
