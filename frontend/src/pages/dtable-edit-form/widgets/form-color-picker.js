import React from 'react';
import PropTypes from 'prop-types';
import { DTableColorPicker } from 'dtable-ui-component';

import '../css/color-picker.css';

class FormColorPicker extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      isShowColorPicker: false,
      popoverStyle: {},
    };
    this.colorPickerContainerRef = null;
    this.colorPickerRef = React.createRef();
  }

  onInputChanged = (event) => {
    const value = event.target.value;
    this.props.onColorChanged(value);
  };

  onPickColorToggle = () => {
    this.setState({ isShowColorPicker: !this.state.isShowColorPicker }, () => {
      if (this.state.isShowColorPicker) {
        this.getPopoverStyle();
      }
    });
  };

  getPopoverStyle = () => {
    if (!this.colorPickerContainerRef || !this.colorPickerRef) return {};
    setTimeout(() => {
      const { top, height } = this.colorPickerContainerRef.getBoundingClientRect();
      const { clientHeight } = document.body;
      const selectTop = top + height;
      let colorPickerHeight = 0;
      if (this.colorPickerRef.current) {
        colorPickerHeight = this.colorPickerRef.current.getHeight();
      }
      let style = { left: 0 };
      if (clientHeight - selectTop < colorPickerHeight) {
        style = { ...style, bottom: '2.375rem' };
      }
      this.setState({ popoverStyle: style });
    }, 10);
  };

  render() {
    const { activeColor } = this.props;
    const isWhiteColor = activeColor && activeColor.toUpperCase() === '#FFFFFF';

    return (
      <div className="color-picker-container" ref={ref => this.colorPickerContainerRef = ref}>
        <div className="picker-control">
          <div
            className={`color-control ${isWhiteColor ? 'white-color' : ''}`}
            onClick={this.onPickColorToggle}
            style={{ background: activeColor }}
          >
          </div>
          <input className="text-control" type="text" value={activeColor} onChange={this.onInputChanged} />
        </div>
        {this.state.isShowColorPicker && (
          <DTableColorPicker
            ref={this.colorPickerRef}
            color={activeColor}
            onSubmit={this.props.onColorChanged}
            onToggle={this.onPickColorToggle}
            popoverStyle={this.state.popoverStyle}
          />
        )}
      </div>
    );
  }
}

FormColorPicker.propTypes = {
  readOnly: PropTypes.bool,
  activeColor: PropTypes.string.isRequired,
  onColorChanged: PropTypes.func.isRequired,
};

FormColorPicker.defaultProps = {
  activeColor: '#000000'
};

export default FormColorPicker;
