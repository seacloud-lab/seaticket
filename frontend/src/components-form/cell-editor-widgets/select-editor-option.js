import React from 'react';
import PropTypes from 'prop-types';
import '../cell-css/select-editor-option.css';

const propTypes = {
  option: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    textColor: PropTypes.string.isRequired,
  }).isRequired,
  isShowRemoveIcon: PropTypes.bool,
  onDeleteSelectOption: PropTypes.func,
};

class SelectEditorOption extends React.Component {

  static defaultProps = {
    isShowRemoveIcon: false,
  };

  onDeleteOption = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    this.props.onDeleteSelectOption(this.props.option);
  };

  onMouseDown = (event) => {
    event.stopPropagation();
  };

  getContainerStyle = () => {
    return { backgroundColor: this.props.option.color };
  };

  getOptionStyle = (option) => {
    const textColor = option.textColor || null;
    return {
      color: textColor,
      maxWidth: this.props.isShowRemoveIcon ? 'calc(100% - 20px)' : '100%',
    };
  };

  getOperationStyle = (option) => {
    const textColor = option.textColor || null;
    return {
      color: textColor === '#FFFFFF' ? '#FFFFFF' : '#909090',
    };
  };

  getOptionNameStyle = () => {
    const { isShowRemoveIcon } = this.props;
    // The remove icon width is 16px
    const maxWidth = isShowRemoveIcon ? 500 : 516;
    return { maxWidth };
  };

  render() {
    let { option, isShowRemoveIcon } = this.props;
    let containerStyle = this.getContainerStyle();
    let optionStyle = this.getOptionStyle(option);
    let optionNameStyle = this.getOptionNameStyle();
    let operationStyle = this.getOperationStyle(option);

    return (
      <div className="select-option-item" style={containerStyle}>
        <div className="option-info" style={optionStyle}>
          <div className="option-name text-truncate" title={option.name} style={optionNameStyle}>{option.name}</div>
        </div>
        {isShowRemoveIcon && (
          <div className="option-remove" style={operationStyle} onClick={this.onDeleteOption} onMouseDown={this.onMouseDown}>
            <i className="dtable-font dtable-icon-fork-number"></i>
          </div>
        )}
      </div>
    );
  }
}

SelectEditorOption.propTypes = propTypes;

export default SelectEditorOption;
