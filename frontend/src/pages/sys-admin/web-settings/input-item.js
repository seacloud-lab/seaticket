import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import { gettext } from '../../../constants';
import SettingItemBase from './setting-item-base';
import { IconButton } from '../../../components';

const propTypes = {
  inputType: PropTypes.string,
  saveSetting: PropTypes.func.isRequired,
  keyText: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  helpTip: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired
};

class WebSettingInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isBtnsShown: false,
      value: this.props.value
    };
  }

  toggleBtns = () => {
    this.setState({ isBtnsShown: !this.state.isBtnsShown });
  };

  hideBtns = (e) => {
    if (!this.state.isBtnsShown) {
      return;
    }
    if (this.props.value !== this.state.value) {
      this.setState({ value: this.props.value });
    }
    this.toggleBtns();
  };

  onInputChange = (e) => {
    this.setState({ value: e.target.value });
  };

  onSubmit = (e) => {
    const value = this.state.value.trim();
    if (value !== this.props.value) {
      this.props.saveSetting(this.props.keyText, value);
    }
    this.toggleBtns();
  };

  render() {
    const { isBtnsShown, value } = this.state;
    const { helpTip, displayName, inputType } = this.props;
    return (
      <SettingItemBase
        displayName={displayName}
        helpTip={helpTip}
        mainContent={
          <Input type={inputType || 'text'} className={inputType === 'textarea' ? 'web-setting-textarea' : ''} onChange={this.onInputChange} onFocus={this.toggleBtns} onBlur={this.hideBtns} value={value} />
        }
        extraContent={
          isBtnsShown ?
            <Fragment>
              <IconButton className="btn btn-secondary web-setting-icon-btn-submit" icon="check" onClick={this.onSubmit} title={gettext('Submit')} aria-label={gettext('Submit')} />
              <IconButton className="btn btn-secondary web-setting-icon-btn-cancel ml-2" icon="x" title={gettext('Cancel')} aria-label={gettext('Cancel')} />
            </Fragment> : null
        }
      />
    );
  }
}

WebSettingInput.propTypes = propTypes;

export default WebSettingInput;
