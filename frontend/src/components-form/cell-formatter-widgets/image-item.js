import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  imageItem: PropTypes.string.isRequired,
};

class ImageItem extends React.Component {

  onImageDoubleClick = () => {
    // todo
  };

  render() {
    // todo previewer

    return (
      <div className="image-item">
        <img alt='' src={this.props.imageItem} onDoubleClick={this.onImageDoubleClick} />
      </div>
    );
  }
}

ImageItem.propTypes = propTypes;

export default ImageItem;
