import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, Alert } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { DTableCustomFooter } from 'dtable-ui-component';
import GeolocationSelectorList from './selector-list';
import SelectorHeaderItem from './selector-header-item';
import Loading from '../../../../components/loading';
import parseGeolocation from './parse-geolocation';

const propTypes = {
  value: PropTypes.object,
  setValue: PropTypes.func,
  onCancel: PropTypes.func,
  onSubmit: PropTypes.func,
};

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

class ProvinceCityEditor extends Component {

  constructor(props) {
    super(props);
    this.value = props.value || {};
    this.locations = {};
    this.state = {
      isShowSelector: false,
      location: this.getLocationText(this.value.province, this.value.city, this.value.district),
      selectedProvince: null,
      selectedCity: null,
      selectedItem: 'province',
      isLoadingData: true,
      errMessage: ''
    };
    this.timer = null;
    this.isComposing = false;
  }

  getLocationText = (province = '', city = '') => {
    return province + city;
  };

  componentDidMount() {
    if (!window.app.location) {
      this.getLocationData().then((data) => {
        this.locations = data;
        window.app.location = data;
        const { selectedProvince, selectedCity, selectedItem } = this.initLocationSelecting(this.value);
        this.setState({
          isLoadingData: false,
          selectedProvince,
          selectedCity,
          selectedItem
        });
      });
    } else {
      this.locations = window.app.location;
      const { selectedProvince, selectedCity, selectedItem } = this.initLocationSelecting(this.value);
      this.setState({
        isLoadingData: false,
        selectedProvince,
        selectedCity,
        selectedItem
      });
    }
  }


  initLocationSelecting = (value) => {
    let selectedProvince = this.locations.children.find((province) => {
      return value.province && value.province.length > 0 && province.name.includes(value.province);
    });

    if (!selectedProvince) {
      return { selectedProvince: null, selectedCity: null, selectedItem: 'province' };
    }

    let selectedCity = selectedProvince.children.find((city) => {
      return value.city && value.city.length > 0 && city.name.includes(value.city);
    });

    if (!selectedCity) {
      return { selectedProvince, selectedCity: null, selectedItem: 'city' };
    }

    return { selectedProvince, selectedCity, selectedItem: 'city' };
  };

  getLocationData = () => {

    // get locations from server
    return fetch(`${mediaUrl}geo-data/cn-location.json`).then((res) => {
      return res.json();
    }).catch(() => {
      // get locations from local
      return fetch('./geo-data/cn-location.json').then(res => {
        return res.json();
      });
    });
  };

  onToggleSelector = () => {
    this.setState({
      isShowSelector: !this.state.isShowSelector,
      errMessage: ''
    });
  };

  selectProvince = (province) => {
    this.setState({
      selectedProvince: province,
      selectedItem: 'city',
      selectedCity: null,
      location: this.getLocationText(province.name),
    });
    this.value = Object.assign({}, this.value, { province: province.name, city: '', district: '' });
    this.props.setValue(this.value);
  };

  selectCity = (city) => {
    this.setState({
      selectedCity: city,
      isShowSelector: false,
      location: this.getLocationText(this.state.selectedProvince.name, city.name)
    });
    this.value = Object.assign({}, this.value, { city: city.name, district: '' });
    this.props.setValue(this.value);
  };


  selectSelectorType = (type) => {
    const { selectedProvince } = this.state;
    if (!selectedProvince) return;
    this.setState({
      selectedItem: type
    });
  };

  onClick = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  onParseChange = () => {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(() => {
      clearTimeout(this.timer);
      this.timer = null;
      const value = this.parseRef.value;
      if (this.isComposing) return;
      const { province, city } = parseGeolocation(this.locations, value);
      this.value = Object.assign({}, this.value);
      this.props.setValue(this.value);
      if (!province) return;
      this.selectProvince(province);
      if (!city) return;
      this.selectCity(city);
    }, 100);
  };

  onCompositionStart = () => {
    this.isComposing = true;
  };

  onCompositionEnd = () => {
    this.isComposing = false;
  };

  onKeyDown = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (isHotkey('esc', e)) {
      this.props.onCancel();
    }
  };

  onSubmit = () => {
    const { province, city } = this.value;
    if (!province || !city) {
      const errMessage = gettext('Province/City must be filled in');
      this.setState({ errMessage });
      return;
    }
    this.props.onSubmit();
  };

  render() {
    const { selectedItem, selectedCity, selectedProvince, isShowSelector, isLoadingData, location } = this.state;
    return (
      <Fragment>
        {!isLoadingData ? (
          <div onClick={this.onClick} className="geolocation-editor-content">
            <div className="geolocation-editor-item geolocation-editor-selector-container">
              <div className="geolocation-editor-item-left">
                {gettext('Address information') + ':'}
              </div>
              <div className="geolocation-editor-item-right">
                <div
                  onClick={this.onToggleSelector}
                  className={`geolocation-editor-selector text-truncate ${isShowSelector ? 'focus' : ''}`}
                >
                  <span className="selected-option-show">
                    {location ? location : gettext('Select province city')}
                  </span>
                  <span className="dtable-font dtable-icon-down3 geolocation-editor-parameter-icon"></span>
                </div>
              </div>
              {isShowSelector && (
                <div className="geolocation-selector-container">
                  <div className="geolocation-selector-header">
                    <SelectorHeaderItem
                      type="province"
                      clickHandler={this.selectSelectorType}
                      selectedType={selectedItem}
                      selectedItem={selectedProvince}
                    />
                    <SelectorHeaderItem
                      type="city"
                      clickHandler={this.selectSelectorType}
                      selectedType={selectedItem}
                      selectedItem={selectedCity}
                    />
                  </div>
                  <div className="geolocation-selector-body">
                    {selectedItem === 'province' && (
                      <GeolocationSelectorList
                        type="province"
                        parent={this.locations}
                        selectedItem={selectedProvince}
                        clickHandler={this.selectProvince}
                      />
                    )}
                    {selectedItem === 'city' && (
                      <GeolocationSelectorList
                        type="city"
                        parent={selectedProvince}
                        selectedItem={selectedCity}
                        clickHandler={this.selectCity}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="geolocation-editor-item geolocation-editor-parse">
              <div className="geolocation-editor-item-left">
                {gettext('Auto recognition') + ':'}
              </div>
              <div className="geolocation-editor-item-right">
                <textarea
                  ref={ref => (this.parseRef = ref)}
                  placeholder={gettext('Try pasting addresses, such as provinces/cities information, to quickly identify the address information')}
                  className="geolocation-editor-detail-info geolocation-editor-recognition"
                  type="text"
                  onChange={this.onParseChange}
                  onKeyDown={this.onKeyDown}
                  onCompositionEnd={this.onCompositionEnd}
                  onCompositionStart={this.onCompositionStart}
                />
              </div>
            </div>
          </div>
        ) : (
          <Loading />
        )}
        {this.state.errMessage && <Alert color="danger" className="mt-2">{this.state.errMessage}</Alert>}
        <DTableCustomFooter>
          <Button onClick={this.props.onCancel} color='secondary'>
            {gettext('Cancel')}
          </Button>
          <Button onClick={this.onSubmit} color='primary' autoFocus>
            {gettext('Submit')}
          </Button>
        </DTableCustomFooter>
      </Fragment>
    )
    ;
  }
}

ProvinceCityEditor.propTypes = propTypes;

export default ProvinceCityEditor;
