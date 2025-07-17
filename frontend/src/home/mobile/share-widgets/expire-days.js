import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'reactstrap';
import { List, InputItem, MobileCommonHeader } from '../../../components';
import {
  gettext,
  shareLinkExpireDaysMax,
  shareLinkExpireDaysMin,
} from '../../../constants';

const propTypes = {
  isExpireDaysNoLimit: PropTypes.bool,
  expireDays: PropTypes.string,
  setExpireDays: PropTypes.func,
  toggle: PropTypes.func.isRequired
};

const MAX_EXPIRE_DAYS = 36500;

class ExpireDays extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      expireDays: props.expireDays || '',
      errorMessage: null
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  onExpireDaysChanged = (value) => {
    this.setState({ expireDays: value, errorMessage: null });
  };

  addExpireDays = () => {
    let { expireDays } = this.state;
    if (this.props.isExpireDaysNoLimit) {
      if (!expireDays) {
        this.props.setExpireDays(expireDays);
        this.toggle();
        return;
      }
    }
    const { errorMessage } = this.validParams();
    if (errorMessage) {
      this.setState({ errorMessage });
      return;
    }
    this.props.setExpireDays(expireDays);
    this.toggle();
  };

  validParams = () => {
    const { isExpireDaysNoLimit } = this.props;
    let { expireDays } = this.state;
    let reg = /^\d+$/;

    if (!expireDays) {
      return { errorMessage: gettext('Please enter days') };
    }

    if (expireDays > MAX_EXPIRE_DAYS) {
      return { errorMessage: gettext('Expire days is too long') };
    }

    if (!reg.test(expireDays)) {
      return { errorMessage: gettext('Please enter a non-negative integer') };
    }
    if (!isExpireDaysNoLimit) {

      expireDays = parseInt(expireDays);
      let minDays = parseInt(shareLinkExpireDaysMin);
      let maxDays = parseInt(shareLinkExpireDaysMax);

      if (minDays !== 0 && minDays !== maxDays) {
        if (expireDays < minDays) {
          return { errorMessage: gettext('Please enter valid days') };
        }
      }

      if (minDays === 0 && maxDays !== 0 ) {
        if (expireDays > maxDays) {
          return { errorMessage: gettext('Please enter valid days') };
        }
      }

      if (minDays !== 0 && maxDays !== 0) {
        if (expireDays < minDays || expireDays > maxDays) {
          return { errorMessage: gettext('Please enter valid days') };
        }
      }
    }

    return { errorMessage: false };
  };

  renderHeader = () => {
    if (shareLinkExpireDaysMin && shareLinkExpireDaysMax && (parseInt(shareLinkExpireDaysMin) !== 0 && parseInt(shareLinkExpireDaysMax) !== 0)) {
      return (
        <span>
          {`${gettext('Days')} (${shareLinkExpireDaysMin} - ${shareLinkExpireDaysMax} ${gettext('days')})`}
        </span>
      );
    } else if ((parseInt(shareLinkExpireDaysMin) !== 0 && parseInt(shareLinkExpireDaysMax) === 0)) {
      return (
        <span>
          {`${gettext('Days')} (${gettext('Greater than or equal to')} ${shareLinkExpireDaysMin} ${gettext('days')})`}
        </span>
      );
    } else if ((parseInt(shareLinkExpireDaysMin) === 0 && parseInt(shareLinkExpireDaysMax) !== 0)) {
      return (
        <span>
          {`${gettext('Days')} (${gettext('Less than or equal to')} ${shareLinkExpireDaysMax} ${gettext('days')})`}
        </span>
      );
    } else {
      return (
        <span>{gettext('Days')}</span>
      );
    }
  };

  render() {
    const { expireDays, errorMessage } = this.state;
    return (
      <div className="mobile-share-project">
        <MobileCommonHeader
          title={gettext('Add auto expiration')}
          titleClass='mobile-share-header'
          onLeftClick={this.toggle}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onRightClick={this.addExpireDays}
          rightStyle={{ color: '#ED7109' }}
        />
        <List
          renderHeader={this.renderHeader()}
        >
          <InputItem onChange={this.onExpireDaysChanged} value={expireDays} />
          <div className="extra-item-container">
            <span className="extra-item extra-item-expire-day">
              {gettext('days')}
            </span>
          </div>
        </List>
        {errorMessage && <Alert color="danger" className="mt-2">{errorMessage}</Alert>}
      </div>
    );
  }
}

ExpireDays.propTypes = propTypes;

export default ExpireDays;
