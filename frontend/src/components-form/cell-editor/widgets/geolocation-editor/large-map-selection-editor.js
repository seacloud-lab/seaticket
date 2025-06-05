import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'reactstrap';
import { Loading, toaster } from 'dtable-ui-component';
import { Utils } from '../../../../utils/utils';
import {
  loadMapSource,
  getInitValue,
  getInitCenter,
  addMapControl,
  addSelectionMarkerByPosition,
  getSelectionLocationValue,
  initSelectionValue
} from './map-editor-utils';
import { LARGE_MAP_EDITOR_DIALOG_MODAL } from './constants';
import { gettext } from '../../../../utils/constants';

class LargeMapSelectionEditorDialog extends Component {

  constructor(props) {
    super(props);
    const value = getInitValue(this.props.value);
    const inputValue = value.title || value.address || '';
    this.state = {
      isLoading: true,
      inputValue,
      value,
      searchResults: [],
    };
    this.map = null;
  }

  componentDidMount() {
    if (!this.props.mapKey) return;
    if (!window.BMap) {
      // register global render function of map
      window.renderBaiduMap = () => this.renderBaiduMap();
      loadMapSource(this.props.mapKey);
    } else {
      this.renderBaiduMap();
    }
  }

  componentWillUnmount() {
    if (this.map && this.props.mapKey) {
      let center = {};
      let zoom = this.map.getZoom();
      let coordinate = this.map.getCenter();
      center.zoom = zoom;
      center.lng = coordinate.lng;
      center.lat = coordinate.lat;
      localStorage.setItem('form-geolocation-map-center', JSON.stringify(center));
      this.map = null;
    }
  }

  renderBaiduMap = () => {
    this.setState({ isLoading: false }, () => {
      if (!window.BMap.Map) return;
      this.map = new window.BMap.Map('geolocation-map-container-large', { enableMapClick: false });
      const { zoom } = getInitCenter(true);
      const { value } = this.state;
      const { lng, lat } = initSelectionValue(this.map, value, this.props.setValue, this.props.onSubmit);
      let point = new window.BMap.Point(lng, lat);
      addMapControl(this.map, this.geolocationCallback);
      this.map.centerAndZoom(point, zoom);
      this.map.enableScrollWheelZoom(true);
      this.map.addEventListener('click', (event) => {
        if (this.state.searchResults.length > 0) {
          this.setState({ searchResults: [] });
          return;
        }
        const point = event.point;
        const geoCoder = new window.BMap.Geocoder();
        geoCoder.getLocation(point, (result) => {
          const value = getSelectionLocationValue(result);
          addSelectionMarkerByPosition(this.map, value, this.props.setValue, this.props.onSubmit);
        });
      });
    });
  };

  onChange = (e) => {
    const inputValue = e.target.value;
    this.setState({ inputValue });
  };

  onKeyDown = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (event.keyCode === Utils.keyCodes.enter) {
      this.onSearch();
    } else if (event.keyCode === Utils.keyCodes.backspace) {
      this.setState({ searchResults: [] });
    }
  };

  onClickSelection = (result) => {
    this.setState({ searchResults: [] }, () => {
      addSelectionMarkerByPosition(this.map, result, this.props.setValue, this.props.onSubmit);
    });
  };

  onSearch = () => {
    const { inputValue } = this.state;
    let options = {
      onSearchComplete: (results) => {
        const status = local.getStatus();
        if (status !== window.BMAP_STATUS_SUCCESS) {
          toaster.danger(gettext('Search failed, please enter detailed address'));
          return;
        }
        let searchResults = [];
        for (let i = 0; i < results.getCurrentNumPois(); i++) {
          const value = results.getPoi(i);
          let position = {};
          position.address = value.address || '';
          position.title = value.title || '';
          position.tag = value.tags || [];
          position.lngLat = { lng: value.point.lng, lat: value.point.lat };
          searchResults.push(position);
        }
        this.setState({ searchResults });
      }
    };
    let local = new window.BMap.LocalSearch(this.map, options);
    local.search(inputValue);
  };

  clearSearchNumerical = () => {
    this.setState({ inputValue: '', searchResults: [] });
  };

  toggle = () => {
    this.props.toggleFullScreen();
  };

  geolocationCallback = (error, point) => {
    if (!error) {
      const geoCoder = new window.BMap.Geocoder();
      geoCoder.getLocation(point, (result) => {
        const value = getSelectionLocationValue(result);
        addSelectionMarkerByPosition(this.map, value, this.props.setValue, this.props.onSubmit);
      });
    } else {
      toaster.danger(gettext('Positioning failed'));
    }
  };

  renderSearchResults = () => {
    const { searchResults } = this.state;
    if (searchResults.length === 0) return null;
    return (
      <div className='search-results-container'>
        {searchResults.map((result, index) => {
          return (
            <div className='search-result-item' key={index} onClick={this.onClickSelection.bind(this, result)}>
              <span className='search-result-item-title'>{result.title || ''}</span>
              <span className='search-result-item-address'>{result.address || ''}</span>
            </div>
          );
        })}
      </div>
    );
  };

  handleClick = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    e.stopPropagation();
  };

  render() {
    const { mapKey } = this.props;
    const { isLoading, inputValue } = this.state;
    return (
      <Modal size='lg' isOpen toggle={this.toggle} className='large-map-editor-dialog selection-large-dialog' zIndex={LARGE_MAP_EDITOR_DIALOG_MODAL}>
        <div className='geolocation-map-editor-header' onClick={this.handleClick}>
          <div className='geolocation-map-editor-logo'>
            <span className='dtable-font dtable-icon-location'></span>
            <span className='ml-2 geolocation-map-editor-title'>{gettext('Address')}</span>
          </div>
          <span className='geolocation-map-editor-screen dtable-font dtable-icon-full-screen' onClick={this.toggle}></span>
        </div>
        <div className='geolocation-map-editor-large' onClick={this.handleClick}>
          {mapKey &&
            <div className='map-editor-header'>
              <div className="search-tables-container d-flex">
                <input
                  type="text"
                  value={inputValue}
                  onChange={this.onChange}
                  onKeyDown={this.onKeyDown}
                  className='form-control selection-input-large'
                  placeholder={gettext('Please enter the address')}
                  autoFocus
                />
                {inputValue && <span className="clear-search-numerical dtable-font dtable-icon-x-" onClick={this.clearSearchNumerical}></span>}
                <span className="search-selection-editor" onClick={this.onSearch}>
                  <i className='dtable-font dtable-icon-search'></i>
                </span>
              </div>
            </div>
          }
          <div className='geolocation-map-container-large'>
            {(mapKey && isLoading) && <Loading />}
            {(!mapKey) && (
              <div className='error-message d-flex justify-content-center mt-9'>
                <span className="alert-danger">{gettext('The map is not properly configured. Please contact the administrator.')}</span>
              </div>
            )}
            {(!isLoading && mapKey) && (
              <div className='w-100 h-100' ref={ref => this.ref = ref} id="geolocation-map-container-large"></div>
            )}
          </div>
          {this.renderSearchResults()}
        </div>
      </Modal>
    );
  }
}

LargeMapSelectionEditorDialog.propTypes = {
  mapKey: PropTypes.string,
  value: PropTypes.object,
  toggleFullScreen: PropTypes.func,
  onChangePoint: PropTypes.func,
  setValue: PropTypes.func,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
};

export default LargeMapSelectionEditorDialog;
