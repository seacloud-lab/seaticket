import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DTableCustomFooter } from 'dtable-ui-component';
import { Button } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { isValidPosition } from '../../../utils/utils';

const propTypes = {
  value: PropTypes.object,
  setValue: PropTypes.func,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func
};

const gettext = window.gettext;

class SimpleMapEditor extends Component {

  constructor(props) {
    super(props);
    const value = props.value || {};
    const { lng, lat } = value;
    this.state = {
      value,
      inputValue: isValidPosition(lng, lat) ? `${lng}, ${lat}` : '',
    };
  }

  setValue = (point) => {
    this.setState({
      value: {
        lng: point.lng,
        lat: point.lat
      },
      inputValue: `${point.lng}, ${point.lat}`
    }, () => {
      this.props.setValue(this.state.value);
    });
  };

  onChange = (e) => {
    const inputValue = e.target.value;
    this.setState({ inputValue });
    const enSplitCodeIndex = inputValue.indexOf(',');
    const cnSplitCodeIndex = inputValue.indexOf('，');
    if (enSplitCodeIndex > 0 || cnSplitCodeIndex > 0) {
      const splitCodeIndex = enSplitCodeIndex > 0 ? enSplitCodeIndex : cnSplitCodeIndex;
      let lng = parseFloat(inputValue.slice(0, splitCodeIndex).trim());
      let lat = parseFloat(inputValue.slice(splitCodeIndex + 1).trim());
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        this.setState({
          value: { lng, lat }
        }, () => {
          this.props.setValue(this.state.value);
        });
      }
    }
  };

  onKeyDown = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (isHotkey('enter', event)) {
      this.props.onSubmit();
    }
  };

  render() {
    const { inputValue } = this.state;
    return (
      <>
        <div className="geolocation-map-editor">
          <div className="map-editor-header simple-map-header">
            <input
              type="text"
              value={inputValue}
              onKeyDown={this.onKeyDown}
              onChange={this.onChange}
              className='form-control'
              placeholder={gettext('Enter longitude and latitude')}
              autoFocus
            />
          </div>
        </div>
        <DTableCustomFooter>
          <Button onClick={this.props.onCancel} color='secondary'>{gettext('Cancel')}</Button>
          <Button onClick={this.props.onSubmit} color='primary'>{gettext('Submit')}</Button>
        </DTableCustomFooter>
      </>
    );
  }
}

SimpleMapEditor.propTypes = propTypes;

export default SimpleMapEditor;
