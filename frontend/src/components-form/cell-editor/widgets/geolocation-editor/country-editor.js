import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import isHotkey from 'is-hotkey';
import Loading from '../../../../components/loading';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

const propTypes = {
  value: PropTypes.object,
  column: PropTypes.object,
  setValue: PropTypes.func,
  onSubmit: PropTypes.func,
};

class CountryEditor extends Component {

  constructor(props) {
    super(props);
    this.countryReg = null;
    const { column, value } = props;
    const columnData = column.data || {};
    this.lang = columnData.lang === 'cn' ? 'cn' : 'en';
    this.state = {
      searchingCountry: '',
      value: value.country_region,
      isLoadingData: true,
    };
    this.filteredCountry = [];
  }

  componentDidMount() {
    if (this.lang === 'cn') {
      if (window.app.countryListCn) {
        this.geolocationRegions = window.app.countryListCn;
        this.setState({ isLoadingData: false });
        return;
      }
    } else {
      if (window.app.countryListEn) {
        this.geolocationRegions = window.app.countryListEn;
        this.setState({ isLoadingData: false });
        return;
      }
    }
    this.getLocationData().then((data) => {
      this.geolocationRegions = data || {};
      this.setState({ isLoadingData: false });
      if (this.lang === 'cn') {
        window.app.countryListCn = this.geolocationRegions;
      } else {
        window.app.countryListEn = this.geolocationRegions;
      }
    });
  }

  getLocationData = () => {
    let geoFileName = 'en-region-location';
    if (this.lang === 'cn') {
      geoFileName = 'cn-region-location';
    }
    return fetch(`${mediaUrl}geo-data/${geoFileName}.json`)
      .then(res => {
        return res.json();
      })
      .catch(() => {
        // get locations from local
        return fetch(`./geo-data/${geoFileName}.json`).then(res => {
          return res.json();
        });
      });
  };

  createContinentList = () => {
    let isSearchResultEmpty = true;
    const continents = Object.keys( this.geolocationRegions);
    const continentsList = continents.map((continent) => {
      const countryList = this.createCountryList(continent);
      if (countryList.length > 0) {
        isSearchResultEmpty = false;
        return (
          <Fragment key={continent}>
            <div className="geolocation-region-editor-continent">{continent}</div>
            {countryList}
          </Fragment>
        );
      }
      return <></>;
    });
    if (isSearchResultEmpty) {
      return <div className="country-list-empty">{gettext('No options')}</div>;
    }
    return continentsList;
  };

  createCountryList = (continent) => {
    const { value } = this.state;
    let countryList = this.geolocationRegions[continent].map((country) => {
      if (!this.countryReg || this.countryReg.test(country)) {
        this.filteredCountry.push(country);
        return (
          <div
            className="geolocation-region-editor-country"
            key={country}
            title={country}
            aria-label={country}
            onClick={() => this.onClick(country)}
          >
            <span className={`icon ${value === country ? 'dtable-font dtable-icon-check-mark' : ''}`}></span>
            <span className="country-name">{country}</span>
          </div>
        );
      }
      return null;
    });
    if (this.countryReg) {
      countryList = countryList.filter((item) => item);
    }
    return countryList;
  };

  onClick = (country) => {
    this.props.setValue({ country_region: country });
    this.props.onSubmit();
  };

  onChange = e => {
    const value = e.target.value.trim();
    if (value.length === 0) {
      this.countryReg = null;
    }
    if (value.length > 0) {
      let regStr = '(.*)' + value.split('').join('(.*)') + '(.*)';
      this.countryReg = new RegExp(regStr, 'i');
    }
    this.filteredCountry = [];
    this.setState({
      searchingCountry: e.target.value
    });
  };

  onKeyDown = (e) => {
    e.stopPropagation();
    if (isHotkey('enter', e)) {
      const value = e.target.value;
      if (value && this.filteredCountry && this.filteredCountry.length === 1) {
        this.props.setValue({ country_region: this.filteredCountry[0] });
        this.props.onSubmit();
      }
    }
  };

  render() {
    const { isLoadingData } = this.state;
    return (
      <div className={'geolocation-country-editor'}>
        <div className='geolocation-region-list-header'>
          <Input
            value={this.state.searchingCountry}
            onChange={this.onChange}
            autoFocus={true}
            onKeyDown={this.onKeyDown}
            placeholder={gettext('Search country')}
          />
        </div>
        <div className='geolocation-region-list-container'>
          {isLoadingData ?
            <Loading /> :
            this.createContinentList()
          }
        </div>
      </div>
    );
  }
}

CountryEditor.propTypes = propTypes;

export default CountryEditor;
