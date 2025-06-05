import React from 'react';
import PropTypes from 'prop-types';
import LocationEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/location-editor';
import SimpleMapEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/simple-map-editor';
import CountryEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/country-editor';
import ProvinceEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/province-editor';
import ProvinceCityEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/province-city-editor';
import MapSelectionEditor from '../../../../../components-form/cell-editor/widgets/geolocation-editor/map-selection-editor';
import { GEOLOCATION_FORMAT_MAP } from '../../../../../components-form/cell-editor/widgets/geolocation-editor/constants';
import DTablePopover from '../../../../../components/dtable-popover';

class GeolocationEditor extends React.Component {

  constructor(props) {
    super(props);
    this.value = props.value || {};
    this.initValue = this.value;
    this.state = {
      editorPosition: null
    };
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

  getEditorStyle = () => {
    const editorFormat = this.getGeoFormat();
    if ((editorFormat === GEOLOCATION_FORMAT_MAP.COUNTRY_REGION || editorFormat === GEOLOCATION_FORMAT_MAP.PROVINCE)) {
      return { minHeight: 240, width: 200, height: 'fit-content' };
    }
    if (editorFormat === GEOLOCATION_FORMAT_MAP.PROVINCE_CITY) {
      return { minHeight: 215, width: 200, height: 'fit-content' };
    }
    if (editorFormat === GEOLOCATION_FORMAT_MAP.LNG_LAT) {
      return { width: 400, height: 'fit-content' };
    }
    if (editorFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION) {
      return { minHeight: 434, width: 500, height: 'fit-content' };
    }
    return { minHeight: 310, width: 400, height: 'fit-content' };
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
        <ProvinceCityEditor
          value={this.value}
          setValue={this.setValue}
          column={column}
          onSubmit={this.onSubmit}
          onCancel={this.onCancel}
        />
      );
    }
  };

  render() {
    const { target } = this.props;
    const style = this.getEditorStyle();
    const geoFormat = this.getGeoFormat();
    const isMapSelectionPopover = geoFormat === GEOLOCATION_FORMAT_MAP.MAP_SELECTION;
    return (
      <DTablePopover
        popoverClassName={`geolocation-editor-popover ${isMapSelectionPopover ? 'map-selection-popover' : ''}`}
        hideArrow={true}
        target={target}
        placement="bottom-start"
        hideDTablePopover={this.props.onGeolocationPopoverToggle}
        hideDTablePopoverWithEsc={this.props.onGeolocationPopoverToggle}
      >
        <div style={style}>
          {this.createEditor()}
        </div>
      </DTablePopover>
    );
  }
}

GeolocationEditor.propTypes = {
  mapKey: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  style: PropTypes.object,
  column: PropTypes.object,
  target: PropTypes.string,
  onCommit: PropTypes.func,
  onCommitCancel: PropTypes.func,
  onGeolocationPopoverToggle: PropTypes.func,
};

export default GeolocationEditor;
