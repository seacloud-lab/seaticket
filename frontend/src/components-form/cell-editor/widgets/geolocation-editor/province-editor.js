import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { Utils } from '../../../../utils/utils';
import Loading from '../../../../components/loading';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

const propTypes = {
  value: PropTypes.object,
  setValue: PropTypes.func,
  onSubmit: PropTypes.func
};

class ProvinceEditor extends Component {

  constructor(props) {
    super(props);
    this.value = props.value || {};
    this.locations = {};
    this.state = {
      isLoadingData: true,
      searchingProvince: '',
      value: this.value.province,
      highlightIndex: -1,
    };
    this.filteredProvince = [];
    this.maxItemNum = 5;
    this.itemHeight = 30;
  }

  componentDidMount() {
    if (!window.app.location) {
      this.getLocationData().then((data) => {
        this.locations = data;
        window.app.location = data;
        this.setState({
          isLoadingData: false,
        });
      });
    } else {
      this.locations = window.app.location;
      this.setState({
        isLoadingData: false,
      });
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
  }

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      this.onEnter(e);
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    }
  };

  onEnter = (e) => {
    e.stopPropagation();
    let selectedProvince;
    if (this.filteredProvince.length === 1) {
      selectedProvince = this.filteredProvince[0];
    } else if (this.state.highlightIndex > -1) {
      selectedProvince = this.filteredProvince[this.state.highlightIndex];
    }
    if (selectedProvince) {
      this.onClick(selectedProvince);
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let { highlightIndex } = this.state;
    if (highlightIndex > 0) {
      this.setState({ highlightIndex: highlightIndex - 1 }, () => {
        if (highlightIndex < this.filteredProvince.length - this.maxItemNum) {
          this.selectContainer.scrollTop -= this.itemHeight;
        }
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex } = this.state;
    if (highlightIndex < this.filteredProvince.length - 1) {
      this.setState({ highlightIndex: highlightIndex + 1 }, () => {
        if (highlightIndex >= this.maxItemNum) {
          this.selectContainer.scrollTop += this.itemHeight;
        }
      });
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

  onClick = (country) => {
    this.props.setValue({ province: country });
    this.setState({ value: country });
    this.props.onSubmit();
  };

  onChange = e => {
    const value = e.target.value.trim();
    if (value.length === 0) {
      this.provinceReg = null;
    }
    if (value.length > 0) {
      this.provinceReg = new RegExp(value, 'i');
    }
    this.filteredProvince = [];
    this.setState({
      searchingProvince: e.target.value
    });
  };

  onKeyDown = (e) => {
    e.stopPropagation();
    if (isHotkey('enter', e)) {
      const value = e.target.value;
      if (value && this.filteredProvince && this.filteredProvince.length === 1) {
        this.props.setValue({ province: this.filteredProvince[0] });
        this.props.onSubmit();
      }
    }
  };

  createProvinceList = () => {
    const { value, highlightIndex } = this.state;
    let provinceList = this.locations.children.map((item, index) => {
      if (!this.provinceReg || this.provinceReg.test(item.name) || this.provinceReg.test(item.alphabetic)) {
        if (!this.filteredProvince.includes(item.name)) this.filteredProvince.push(item.name);
        return (
          <div
            className={`geolocation-region-editor-province ${highlightIndex === index ? 'geolocation-region-editor-province-highlight' : ''}`}
            key={item.alphabetic + index}
            title={item.name}
            aria-label={item.name}
            onClick={() => this.onClick(item.name)}
          >
            <span className="province-name">{item.name}</span>
            <span className={`icon ${value === item.name ? 'province-selected-icon dtable-font dtable-icon-check-mark' : ''}`}></span>
          </div>
        );
      }
      return <></>;
    });
    if (this.provinceReg) {
      provinceList = provinceList.filter((item) => item);
    }
    if (provinceList.length === 0) {
      provinceList.push(<div key={'province-null'} className="country-list-empty">{gettext('No options')}</div>);
    }
    return provinceList;
  };

  render() {
    const { isLoadingData } = this.state;
    return (
      <div className="geolocation-province-editor">
        <div className="geolocation-province-list-header">
          <Input
            value={this.state.searchingProvince}
            onChange={this.onChange}
            autoFocus={true}
            onKeyDown={this.onKeyDown}
            placeholder={gettext('Search province')}
          />
        </div>
        <div className="geolocation-province-list-container" ref={ref => this.selectContainer = ref}>
          {isLoadingData ?
            <Loading /> :
            this.createProvinceList()
          }
        </div>
      </div>
    );
  }
}

ProvinceEditor.propTypes = propTypes;

export default ProvinceEditor;
