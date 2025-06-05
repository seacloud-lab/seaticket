import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import LocationEditor from './location-editor';
import SimpleMapEditor from './simple-map-editor';
import CountryEditor from './country-editor';
import ProvinceEditor from './province-editor';
import ProvinceCityEditor from './province-city-editor';
import MapSelectionEditor from './map-selection-editor';
import { GEOLOCATION_FORMAT_MAP } from './constants';

const GeolocationEditorPropTypes = {
  mapKey: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  style: PropTypes.object,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  onCommitCancel: PropTypes.func,
  mode: PropTypes.string,
  rowData: PropTypes.object,
  expandedRow: PropTypes.object,
};

class GeolocationEditor extends React.Component {

  constructor(props) {
    super(props);
    this.value = props.value || {};
    this.initValue = this.value;
    this.state = {
      editorPosition: null
    };
  }

  componentDidMount() {
    this.setEditorPosition();
  }

  setValue = (value) => {
    this.value = value;
  };

  onSubmit = () => {
    this.props.onCommit({ [this.props.column.key]: this.value }, this.props.column);
  };

  onCancel = () => {
    this.props.onCommitCancel();
  };

  setEditorPosition = () => {
    const editorFormat = this.getGeoFormat();
    if (this.ref && (editorFormat === 'country_region' || editorFormat === 'province')) {
      let height = 240; let width = 200;
      let left = this.ref.parentNode.getBoundingClientRect().x; let top = this.ref.parentNode.getBoundingClientRect().y;
      if (top + height > window.innerHeight) {
        top = window.innerHeight - height - 35;
      }
      this.setState({ editorPosition: { top, left, width, zIndex: 1000, position: 'fixed' } }) ;
      return;
    }

    if (this.ref && editorFormat === 'province_city') {
      let height = 215;
      let left = this.ref.parentNode.getBoundingClientRect().x; let top = this.ref.parentNode.getBoundingClientRect().y;
      let geoEditorTop = 0;
      let geoEditorLeft = 0;
      let innerHeight = window.innerHeight;
      geoEditorTop = top;
      geoEditorTop = height + geoEditorTop > innerHeight ? innerHeight - height - 30 : geoEditorTop;
      geoEditorLeft = left;
      this.setState({ editorPosition: { top: geoEditorTop, left: geoEditorLeft, zIndex: 1000, position: 'fixed' } });
      return;
    }
    if (this.ref && editorFormat === 'lng_lat') {
      return;
    }
    if (this.ref) {
      let width = editorFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION ? 500 : 400;
      let height = editorFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION ? 434 : 310;
      let geoEditorTop = 0;
      let geoEditorLeft = 0;
      let innerHeight = window.innerHeight;
      const offsetTop = this.ref.parentNode.getBoundingClientRect().y;
      geoEditorTop = offsetTop;
      geoEditorTop = height + geoEditorTop > innerHeight ? innerHeight - height - 30 : geoEditorTop;
      geoEditorLeft = this.ref.parentNode.getBoundingClientRect().x;
      this.setState({ editorPosition: { top: geoEditorTop, left: geoEditorLeft, zIndex: 1000, position: 'fixed', width } });
    }
  };

  getGeoFormat = () => {
    const { column } = this.props;
    let data = column.data || {};
    return data.geo_format ? data.geo_format : 'geolocation';
  };

  createEditor = () => {
    const geoFormat = this.getGeoFormat();
    const { column, mapKey } = this.props;
    if (geoFormat === GEOLOCATION_FORMAT_MAP.LNG_LAT) {
      return (
        <SimpleMapEditor
          value={this.value}
          setValue={this.setValue}
          onSubmit={this.onSubmit}
          onCancel={this.onCancel}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) {
      return (
        <MapSelectionEditor
          mapKey={mapKey}
          value={this.value}
          setValue={this.setValue}
          column={column}
          onCancel={this.onCancel}
          onSubmit={this.onSubmit}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.GEOLOCATION) {
      return (
        <LocationEditor
          value={this.value}
          setValue={this.setValue}
          column={column}
          onCancel={this.onCancel}
          onSubmit={this.onSubmit}
          isShowAddressDetail={true}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.PROVINCE_CITY_DISTRICT) {
      return (
        <LocationEditor
          value={this.value}
          setValue={this.setValue}
          column={column}
          onCancel={this.onCancel}
          onSubmit={this.onSubmit}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION) {
      return (
        <CountryEditor
          value={this.value}
          setValue={this.setValue}
          onSubmit={this.onSubmit}
          column={column}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.PROVINCE) {
      return (
        <ProvinceEditor
          value={this.value}
          setValue={this.setValue}
          onSubmit={this.onSubmit}
        />
      );
    }

    if (geoFormat === GEOLOCATION_FORMAT_MAP.PROVINCE_CITY) {
      return (
        <Fragment>
          <ProvinceCityEditor
            value={this.value}
            setValue={this.setValue}
            column={column}
            onSubmit={this.onSubmit}
            onCancel={this.onCancel}
          />
        </Fragment>
      );
    }
  };

  render() {
    const { editorPosition } = this.state;
    return (
      <div ref={(ref) => this.ref = ref} style={editorPosition} className='geolocation-editor-container'>
        {this.createEditor()}
      </div>
    );
  }
}

GeolocationEditor.propTypes = GeolocationEditorPropTypes;

export default GeolocationEditor;
