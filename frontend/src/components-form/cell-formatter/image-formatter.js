import React from 'react';
import PropTypes from 'prop-types';
import ImageItem from '../cell-formatter-widgets/image-item';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
};

class ImageFormatter extends React.Component {

  // todo previewer
  onImageClick = () => {

  };

  render() {
    let value = this.props.value;
    return (
      <div className="cell-formatter grid-cell-type-image">
        {value && Array.isArray(value) && value.map((item, index) => {
          return <ImageItem key={index} imageItem={item}/>;
        })}
      </div>
    );
  }
}

ImageFormatter.propTypes = propTypes;

export default ImageFormatter;
