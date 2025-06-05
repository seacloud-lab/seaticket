import React from 'react';
import PropTypes from 'prop-types';
import { ImagePreviewerLightbox } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import CommonAddTool from '../../components/common-add-tool';

const propTypes = {
  value: PropTypes.array,
  togglePreviewer: PropTypes.func,
  deleteImage: PropTypes.func,
  resetAdditionImage: PropTypes.func,
  closeEditor: PropTypes.func,
};

class ImageListPreviewer extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLargeImage: false,
      largeImageIndex: -1,
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const { value } = nextProps;
    if (prevState.isShowLargeImage) {
      if (value.length === 0 && prevState.largeImageIndex > -1) {
        return {
          largeImageIndex: -1,
          isShowLargeImage: false,
        };
      }
      if (value.length < prevState.largeImageIndex + 1) {
        return {
          largeImageIndex: value.length - 1,
        };
      }
    }
    return null;
  }

  componentDidMount() {
    const offsetWidth = document.body.offsetWidth;
    this.containerSize = offsetWidth < 767.8 ? ((offsetWidth - 55 ) / 2) + 'px' : ((offsetWidth - 80 ) / 3) + 'px';
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  handleHistoryBack = () => {
    this.props.closeEditor();
  };

  togglePreviewer = () => {
    this.props.togglePreviewer('addition');
    this.props.resetAdditionImage();
  };

  deleteImage = (index) => {
    this.props.deleteImage(index);
  };

  onImageClick = (index) => {
    this.setState({
      isShowLargeImage: true,
      largeImageIndex: index
    });
  };

  hideLargeImage = () => {
    this.setState({
      isShowLargeImage: false,
      largeImageIndex: -1,
    });
  };

  moveNext = () => {
    let images = this.props.value;
    this.setState(prevState => ({
      largeImageIndex: (prevState.largeImageIndex + 1) % images.length,
    }));
  };

  movePrev = () => {
    let images = this.props.value;
    this.setState(prevState => ({
      largeImageIndex: (prevState.largeImageIndex + images.length - 1) % images.length,
    }));
  };

  render() {
    let { value } = this.props;
    let { largeImageIndex, isShowLargeImage } = this.state;
    return (
      <div className="image-previewer-container">
        <div className={`image-previewer-wrapper ${value.length === 0 ? 'd-none' : ''}`}>
          <div className="image-previewer-content">
            {value.length > 0 && value.map((imageItemUrl, index) => {
              return (
                <div
                  style={{ width: this.containerSize, height: this.containerSize}}
                  className="image-previewer-box"
                  onClick={() => {this.onImageClick(index);}}
                >
                  <img src={imageItemUrl} alt=""/>
                </div>
              );
            })}
          </div>
        </div>
        {isShowLargeImage &&
          <ImagePreviewerLightbox
            readOnly={false}
            imageItems={value}
            imageIndex={largeImageIndex}
            closeImagePopup={this.hideLargeImage}
            moveToPrevImage={this.movePrev}
            moveToNextImage={this.moveNext}
            deleteImage={() => {this.deleteImage(largeImageIndex);}}
          />
        }
        <div className={`view-partition ${value.length === 0 ? 'd-none' : ''}`} style={{borderTop: '1px solid #e9e9e9'}}></div>
        <CommonAddTool callBack={this.togglePreviewer} footerName={gettext('Add images')} />
      </div>
    );
  }
}

ImageListPreviewer.propTypes = propTypes;

export default ImageListPreviewer;
