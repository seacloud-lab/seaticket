import React from 'react';
import PropTypes from 'prop-types';
import FileItem from '../cell-formatter-widgets/file-item';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
};

class FileFormatter extends React.Component {

  // todo
  onFileItemClick = () => {

  };

  render() {
    let value = this.props.value;
    return (
      <div className="cell-formatter grid-cell-type-file">
        {value && Array.isArray(value) && value.map((item, index) => {
          return <FileItem key={index} fileItem={item}/>;
        })}
      </div>
    );
  }
}

FileFormatter.propTypes = propTypes;

export default FileFormatter;
