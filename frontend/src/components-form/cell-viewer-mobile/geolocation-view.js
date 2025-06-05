import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button } from 'reactstrap';
import { InputItem, Picker, List } from 'antd-mobile';
import { Loading, toaster } from 'dtable-ui-component';
import { isValidPosition } from '../utils/utils';
import MobileCommonHeader from '../../pages/dtable/mobile/mobile-common-header';
import ModalPortal from '../../components/modal-portal';
import { GEOLOCATION_FORMAT_MAP } from '../cell-editor/widgets/geolocation-editor/constants';
import {
  loadMapSource,
  getInitCenter,
  getInitValue,
  addMapControl,
  getSelectionLocationValue,
} from '../cell-editor/widgets/geolocation-editor/map-editor-utils';
import { INPUT_MODE_MAP } from '../../constants/form-constants';

import '../cell-css/mobile/geolocation-view.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

const propTypes = {
  mapKey: PropTypes.string,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onCommit: PropTypes.func,
  closeEditor: PropTypes.func,
  expandedRow: PropTypes.object,
  readOnly: PropTypes.bool
};

class GeolocationEditorView extends React.PureComponent {

  constructor(props) {
    super(props);
    const value = props.value || {};
    this.geoFormat = this.getGeoFormat();
    this.canSelectPosition = true;
    this.geolocationArray = [GEOLOCATION_FORMAT_MAP.GEOLOCATION, GEOLOCATION_FORMAT_MAP.PROVINCE,
      GEOLOCATION_FORMAT_MAP.PROVINCE_CITY, GEOLOCATION_FORMAT_MAP.PROVINCE_CITY_DISTRICT];
    if (this.geolocationArray.indexOf(this.geoFormat) > -1) {
      this.state = {
        address: (value && value.detail) ? value.detail : '',
        locations: [],
        location: (value && value.province) ? [value.province, value.city, value.district] : [],
        errMessage: ''
      };
    } else if (this.geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      this.state = {
        countryData: {},
        locations: [],
        location: (value && value.country_region) ? [value.country_region] : [],
      };
    } else if (this.geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) {
      const value = getInitValue(this.props.value);
      const inputValue = value.title || value.address || '';
      this.inputMode = this.getInputMode();
      this.canSelectPosition = this.inputMode === INPUT_MODE_MAP.ANY_LOCATION;
      this.state = {
        isLoading: true,
        isShowSearchView: false,
        isShowLabel: false,
        value,
        inputValue,
        searchResults: [],
        selectedSelection: {}
      };
      this.map = null;
      this.geolocationControl = null;
    } else {
      const { lng, lat } = value;
      const inputValue = isValidPosition(lng, lat) ? `${lng}, ${lat}` : '';
      this.state = {
        inputValue,
        value,
      };
    }
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
    if (this.geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION && this.props.mapKey) {
      if (!window.BMap) {
        // register global render function of map
        window.renderBaiduMap = () => this.renderBaiduMap();
        loadMapSource(this.props.mapKey);
      } else {
        this.renderBaiduMap();
      }
    }
  }

  UNSAFE_componentWillMount() {
    if (this.geolocationArray.indexOf(this.geoFormat) > -1) {
      this.initLocations();
    } else if (this.geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      this.initCountryData();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  renderBaiduMap = () => {
    this.setState({ isLoading: false }, () => {
      this.map = new window.BMap.Map('geolocation-map-selection-container');
      let { zoom } = getInitCenter();
      const { lng, lat } = this.initSelectionValue();
      addMapControl(this.map, this.geolocationCallback);
      let point = new window.BMap.Point(lng, lat);
      this.map.centerAndZoom(point, zoom);
      this.map.enableScrollWheelZoom(true);
      if (this.props.readOnly) return;
      this.canSelectPosition && this.map.addEventListener('click', (event) => {
        const point = event.point;
        const geoCoder = new window.BMap.Geocoder();
        geoCoder.getLocation(point, (result) => {
          const value = getSelectionLocationValue(result);
          this.setState({ isShowLabel: true, selectedSelection: value, inputValue: value.title || value.address });
          this.addSelectionMarkerByPosition(value);
        });
      });
      // for mobile device real-time positioning, use current position
      !this.canSelectPosition && this.locateBaiduMapCurrentLocaton();
    });
  };

  initSelectionValue = () => {
    let { lng, lat } = getInitCenter();
    let { value } = this.state;
    const { lngLat, address, title } = value;
    if (lngLat && isValidPosition(lngLat.lng, lngLat.lat)) {
      lng = lngLat.lng;
      lat = lngLat.lat;
      this.setState({ isShowLabel: true, selectedSelection: value });
      this.addSelectionMarkerByPosition(value);
    } else {
      const detail = title || address || '';
      const geoCoder = new window.BMap.Geocoder();
      geoCoder.getPoint(detail, (point) => {
        if (!point) return;
        let newLngLat = {};
        lng = point.lng;
        lat = point.lat;
        newLngLat = { lng, lat };
        value = Object.assign({}, value, { lngLat: newLngLat });
        this.setState({ isShowLabel: true, selectedSelection: value });
        this.addSelectionMarkerByPosition(value);
      });
    }
    return { lng, lat };
  };

  addSelectionMarkerByPosition = (value) => {
    const { lngLat } = value;
    let point = new window.BMap.Point(lngLat.lng, lngLat.lat);
    const marker = new window.BMap.Marker(point, { offset: new window.BMap.Size(-2, -5) });
    if (this.map) {
      this.map.clearOverlays();
      this.map.addOverlay(marker);
      this.map.centerAndZoom(point, 10);
    }
  };

  geolocationCallback = (error, point) => {
    if (this.props.readOnly) return;
    if (!error) {
      const geoCoder = new window.BMap.Geocoder();
      geoCoder.getLocation(point, (result) => {
        let value = {};
        const { surroundingPois, address, point } = result;
        if (surroundingPois.length === 0) {
          value.address = address;
          value.lngLat = { lng: point.lng, lat: point.lat };
          value.tag = [];
          value.title = '';
        } else {
          const position = surroundingPois[0];
          const { address, title, tags, point } = position;
          value.address = address || '';
          value.title = title || '';
          value.tag = tags || [];
          value.lngLat = { lng: point.lng, lat: point.lat };
        }
        this.setState({ isShowLabel: true, selectedSelection: value });
        this.addSelectionMarkerByPosition(value);
      });
    } else {
      toaster.danger(gettext('Positioning failed'));
    }
  };

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.props.closeEditor();
  };

  initLocations = () => {
    if (!window.app.locations) {
      this.getLocationData().then((res) => {
        const data = this.transLocationData(res).children;
        window.app.locations = data;
        this.setState({ locations: data });
      });
    } else {
      this.setState({ locations: window.app.locations });
    }
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

  initCountryData = () => {
    const { column } = this.props;
    const language = column.data.lang;
    if (language === 'cn') {
      if (window.app.countryListCn) {
        this.setState({ countryData: window.app.countryListCn }, () => {
          this.transCountryData();
        });
        return;
      }
    } else {
      if (window.app.countryListEn) {
        this.setState({ countryData: window.app.countryListEn }, () => {
          this.transCountryData();
        });
        return;
      }
    }
    this.getCountryData().then((data) => {
      const initData = data || {};
      this.setState({ countryData: initData }, () => {
        this.transCountryData();
      });
      if (language === 'cn') {
        window.app.countryListCn = initData;
      } else {
        window.app.countryListEn = initData;
      }
    });
  };

  getCountryData = () => {
    const { column } = this.props;
    const language = column.data.lang;
    let geoFileName = 'en-region-location';
    if (language === 'cn') {
      geoFileName = 'cn-region-location';
    }
    // get locations from server
    return fetch(`${mediaUrl}geo-data/${geoFileName}.json`).then(res => {
      return res.json();
    }).catch(() => {
      // get locations from local
      return fetch(`./geo-data/${geoFileName}.json`).then(res => {
        return res.json();
      });
    });
  };

  transCountryData = () => {
    let { countryData } = this.state;
    let countryFormatData = [];
    for (let key in countryData) {
      let obj = {};
      let children = [];
      obj.label = key;
      obj.value = key;
      obj.name = null;
      countryData[key].forEach((item) => {
        let obj = {};
        obj.label = item;
        obj.value = item;
        obj.name = null;
        children.push(obj);
      });
      obj.children = children;
      countryFormatData.push(obj);
    }
    this.setState({ locations: countryFormatData });
  };

  transLocationData = (data) => {
    if (Object.prototype.toString.call(data) === '[object Object]') {
      const name = data.name;
      data.label = name;
      data.value = name;
      data.name = null;
      if (data.children) {
        data.children.map(child => {
          return this.transLocationData(child);
        });
      }
    }
    return data;
  };

  closeDialog = () => {
    const { readOnly } = this.props;
    if (!readOnly) {
      this.onCommit();
    }
  };

  onCommit = () => {
    const column = this.props.column;
    if (this.geolocationArray.indexOf(this.geoFormat) > -1) {
      const { address, location } = this.state;
      if (this.geoFormat === GEOLOCATION_FORMAT_MAP.GEOLOCATION && !address) {
        const errMessage = gettext('Detail must be filled in');
        this.setState({ errMessage });
        return;
      }
      const res = {
        province: location[0],
        city: location[1],
        district: location[2],
        detail: address,
      };
      this.props.onCommit({ [column.key]: res }, column);
    } else if (this.geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      const { location } = this.state;
      const res = {
        country_region: location[0]
      };
      this.props.onCommit({ [column.key]: res }, column);
    } else {
      const { value } = this.state;
      this.props.onCommit({ [column.key]: value }, column);
    }
    this.props.closeEditor();
  };

  onLocationChange = (location) => {
    if (this.geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      this.setState({ location: [location[1]] });
    } else {
      this.setState({ location });
    }
  };

  getLocationCols = (formatType) => {
    if (formatType === GEOLOCATION_FORMAT_MAP.PROVINCE) {
      return 1;
    } else if (formatType === GEOLOCATION_FORMAT_MAP.PROVINCE_CITY || formatType === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      return 2;
    } else if (formatType === GEOLOCATION_FORMAT_MAP.GEOLOCATION || formatType === GEOLOCATION_FORMAT_MAP.PROVINCE_CITY_DISTRICT) {
      return 3;
    }
  };

  renderLocation = (formatType) => {
    const { location, locations } = this.state;
    const locationText = location.length > 0 ? location.join(' ') : gettext('Select location');
    return (
      <>
        <div className="view-subtitle">
          <span>{gettext('Address information')}</span>
        </div>
        <Picker
          className="geolocation-editor-view-picker"
          data={locations}
          value={location}
          format=""
          onChange={this.onLocationChange}
          cascade={true}
          title={gettext('Address information')}
          extra={gettext('Select location')}
          onOk={e => this.onLocationChange(e)}
          okText={gettext('Done')}
          dismissText={gettext('Cancel')}
          cols={this.getLocationCols(formatType)}
        >
          <List.Item arrow="horizontal">{locationText}</List.Item>
        </Picker>
      </>
    );
  };

  onAddressChange = (address) => {
    this.setState({ address });
  };

  onCloseLabel = (e) => {
    e.stopPropagation();
    this.map.clearOverlays();
    this.setState({ isShowLabel: false, selectedSelection: {}, inputValue: '' });
  };

  onFillIn = () => {
    const { selectedSelection } = this.state;
    this.setState({ value: selectedSelection, isShowLabel: false }, () => {
      const { value } = this.state;
      const { column } = this.props;
      this.props.onCommit({ [column.key]: value }, column);
      toaster.success(gettext('Successfully filled in'));
    });
  };

  onClickSelection = (result) => {
    this.setState({
      searchResults: [],
      inputValue: result.title || result.address,
      selectedSelection: result,
      isShowSearchView: false,
      isShowLabel: true
    }, () => {
      this.addSelectionMarkerByPosition(result);
    });
  };

  onSearchSelection = (e) => {
    e.stopPropagation();
    const { inputValue } = this.state;
    if (inputValue) {
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
          this.setState({ searchResults, isShowSearchView: true, isShowLabel: false });
        }
      };
      let local = new window.BMap.LocalSearch(this.map, options);
      local.search(inputValue);
    }
  };

  getInputMode = () => {
    const { column } = this.props;
    const data = column.data;
    if (!data) return INPUT_MODE_MAP.ANY_LOCATION;
    return data.input_mode || INPUT_MODE_MAP.ANY_LOCATION;
  };

  locateBaiduMapCurrentLocaton = () => {
    const geolocation = new window.BMap.Geolocation();
    geolocation.getCurrentPosition((result) => {
      if (result) {
        const point = result.point;
        this.map?.setCenter(point);
        const geoCoder = new window.BMap.Geocoder();
        const value = {};
        geoCoder.getLocation(point, (result) => {
          const { surroundingPois, address, point } = result;
          if (surroundingPois.length === 0) {
            value.address = address;
            value.lngLat = { lng: point.lng, lat: point.lat };
            value.tag = [];
            value.title = '';
          } else {
            const position = surroundingPois[0];
            const { address, title, tags, point } = position;
            value.address = address || '';
            value.title = title || '';
            value.tag = tags || [];
            value.lngLat = { lng: point.lng, lat: point.lat };
          }
          this.setState({ isShowLabel: true, selectedSelection: value, inputValue: value.title || value.address });
          this.addSelectionMarkerByPosition(value);
        });
      } else {
        // Positioning failed
        toaster.danger(gettext('Positioning failed'));
      }
    });
  };

  renderAddress = () => {
    return (
      <>
        <div className="view-subtitle">
          <span>{gettext('Detailed address')}</span>
        </div>
        <InputItem
          placeholder={this.state.address ? '' : gettext('Enter the detailed address, such as road, house number, community')}
          value={this.state.address}
          onChange={this.onAddressChange}
          moneyKeyboardAlign="left"
        >
        </InputItem>
      </>
    );
  };

  renderGeolocationEditor = (formatType) => {
    return (
      <div style={{ height: 'auto' }} className="geolocation-view-container view-partition-border-bottom">
        {this.renderLocation(formatType)}
        {formatType === 'geolocation' && this.renderAddress()}
      </div>
    );
  };

  renderMapEditor = () => {
    const { readOnly } = this.props;
    return (
      <div style={{ height: 'calc(100% - 51px)' }} className="geolocation-view-container">
        {!readOnly && this.renderMapHeader()}
      </div>
    );
  };

  renderMapSelectionHeader = () => {
    const { inputValue } = this.state;
    return (
      <div className='map-selection-view-search'>
        <InputItem
          type="text"
          className="map-selection-view-search-input"
          style={{ marginTop: 0 }}
          value={inputValue}
          onChange={this.handleInputFocusChange}
          clear={true}
          placeholder={gettext('Please enter the address')}
        />
        <span className="search-selection-editor map-selection-view-search-btn" onClick={this.onSearchSelection}>
          <i className='dtable-font dtable-icon-search'></i>
        </span>
      </div>
    );
  };

  renderMap = () => {
    const { mapKey } = this.props;
    const { isLoading } = this.state;
    const style = this.canSelectPosition ? { height: 'calc(100% - 44px)' } : { height: '100%' };
    return (
      <div style={style} className="geolocation-map-container w-100">
        {(mapKey && isLoading) && <Loading />}
        {!mapKey && (
          <div className='error-message d-flex justify-content-center mt-9'>
            <span className="alert-danger">{gettext('The map is not properly configured. Please contact the administrator.')}</span>
          </div>
        )}
        {(!isLoading && mapKey) && <div className='w-100 h-100' ref={ref => this.ref = ref} id='geolocation-map-selection-container'></div>}
      </div>
    );
  };

  renderSearchContainer = () => {
    const { searchResults } = this.state;
    if (searchResults.length === 0) return null;
    return (
      <div className='map-selection-search-results'>
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

  renderLabel = () => {
    const { selectedSelection } = this.state;
    const { address, title, tag } = selectedSelection;
    const tagContent = Array.isArray(tag) && tag.length > 0 ? tag[0] : '';
    if (title) {
      return (
        <div className='map-selection-view-label'>
          <span className='label-title' title={title}>{title}</span>
          {tagContent && <span className='label-tag'>{tagContent}</span>}
          <span className='dtable-font dtable-icon-x' onClick={this.onCloseLabel}></span>
          <span className='label-address-tip'>{gettext('Address')}</span>
          <span className='label-address' title={address}>{address}</span>
          <Button className='label-btn' color='primary' size='sm' onClick={this.onFillIn}>{gettext('Fill in')}</Button>
        </div>
      );
    }
    return (
      <div className='map-selection-view-label simple'>
        <span className='dtable-font dtable-icon-x' onClick={this.onCloseLabel}></span>
        <span className='label-address text-truncate simple' title={address}>{address}</span>
        <Button className='label-btn simple' color='primary' size='sm' onClick={this.onFillIn}>{gettext('Fill in')}</Button>
      </div>
    );
  };

  renderMapSelectionEditor = () => {
    const { readOnly } = this.props;
    const { isShowSearchView, isShowLabel } = this.state;
    return (
      <div style={{ height: 'calc(100% - 51px)' }} className="geolocation-view-container">
        {!readOnly && this.canSelectPosition && this.renderMapSelectionHeader()}
        {this.renderMap()}
        {isShowSearchView && this.renderSearchContainer()}
        {isShowLabel && this.renderLabel()}
      </div>
    );
  };

  renderMapHeader = () => {
    const { inputValue } = this.state;
    return <InputItem
      type="text"
      className="mt-4"
      style={{ marginTop: 0 }}
      value={inputValue}
      onChange={this.handleInputFocusChange}
      placeholder={gettext('Enter longitude and latitude')}
    />;
  };

  handleInputFocusChange = (inputValue) => {
    this.setState({ inputValue });
    if (this.geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) return;
    const enSplitCodeIndex = inputValue.indexOf(',');
    const cnSplitCodeIndex = inputValue.indexOf('，');
    if (enSplitCodeIndex > 0 || cnSplitCodeIndex > 0) {
      let lng; let lat;
      const splitCodeIndex = enSplitCodeIndex > 0 ? enSplitCodeIndex : cnSplitCodeIndex;
      lng = parseFloat(inputValue.slice(0, splitCodeIndex).trim());
      lat = parseFloat(inputValue.slice(splitCodeIndex + 1).trim());
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        this.setState({
          value: { lng, lat }
        });
      }
    }
  };

  closeSearchView = () => {
    this.setState({ isShowSearchView: false });
  };

  getGeoFormat = () => {
    const { column } = this.props;
    const data = column.data;
    if (!data) return GEOLOCATION_FORMAT_MAP.GEOLOCATION;
    return data.geo_format ? data.geo_format : GEOLOCATION_FORMAT_MAP.GEOLOCATION;
  };

  getHeaderContent = () => {
    const { readOnly } = this.props;
    const { isShowSearchView } = this.state;
    if (readOnly) {
      const leftName = gettext('Close'); const rightName = ''; const title = this.props.column.name;
      const onRightClick = null;
      const onLeftClick = this.closeDialog;
      return { leftName, rightName, title, onLeftClick, onRightClick };
    } else if (this.geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) {
      const onRightClick = null;
      const rightName = null;
      const title = this.props.column.name;
      const leftName = <i className="dtable-font dtable-icon-return"></i>;
      let onLeftClick;
      if (isShowSearchView) {
        onLeftClick = this.closeSearchView;
      } else {
        onLeftClick = this.props.closeEditor;
      }
      return { leftName, rightName, title, onLeftClick, onRightClick };
    } else if (this.geoFormat === 'lng_lat') {
      return {
        onLeftClick: this.props.closeEditor,
        leftName: gettext('Cancel'),
        title: this.props.column.name,
        rightName: gettext('Done'),
        onRightClick: this.closeDialog,
      };
    } else {
      const leftName = gettext('Cancel'); const rightName = gettext('Done'); const title = this.props.column.name;
      const onLeftClick = this.props.closeEditor;
      const onRightClick = this.closeDialog;
      return { leftName, rightName, title, onLeftClick, onRightClick };
    }
  };

  getEditor = (formatType) => {
    if (formatType === GEOLOCATION_FORMAT_MAP.LNG_LAT) {
      return this.renderMapEditor();
    } else if (formatType === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) {
      return this.renderMapSelectionEditor();
    } else if (!formatType || this.geolocationArray.indexOf(formatType) > -1 || this.geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      return this.renderGeolocationEditor(formatType);
    }
  };

  render() {
    const { onLeftClick, leftName, title, rightName, onRightClick } = this.getHeaderContent();
    return (
      <ModalPortal>
        <div className="geolocation-view" style={{ backgroundColor: '#f5f5f5' }}>
          <MobileCommonHeader
            title={title}
            onLeftClick={onLeftClick}
            leftName={leftName}
            onRightClick={onRightClick}
            rightName={rightName}
          />
          {this.getEditor(this.geoFormat)}
          {this.state.errMessage && <Alert color="danger" className="mt-2">{this.state.errMessage}</Alert>}
        </div>
      </ModalPortal>
    );
  }
}

GeolocationEditorView.propTypes = propTypes;

export default GeolocationEditorView;
