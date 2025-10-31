import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { enableUserSetContactEmail, gettext } from '@/constants';
import { ModalPortal, toaster } from '@/components';
import SetContactEmailDialog from '@/components/dialog/set-contact-email-dialog';
import profileSettingsAPI from './api';
import { Utils } from '@/utils/utils';

let propTypes = {
  contactEmail: PropTypes.string.isRequired
};


class BindContactEmail extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isShowContactDialog: false
    };
  }

  onToggleContactDialog = () => {
    this.setState({ isShowContactDialog: !this.state.isShowContactDialog });
  };

  onBind = (newContactEmail, cb) => {
    profileSettingsAPI.bindContactEmail(newContactEmail).then(res => {
      toaster.success(gettext('An email has been sent to the new email address. Please click the confirmation link in the email.'));
      this.onToggleContactDialog();
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error, true);
      toaster.danger(errorMsg);
      cb && cb(error);
    });
  };

  render() {
    let { contactEmail } = this.props;
    let showText; let buttonValue;
    if (contactEmail) {
      showText = contactEmail;
      buttonValue = gettext('Update');
    } else {
      showText = gettext('You have not bound an email address');
      buttonValue = gettext('Bind');
    }
    return (
      <Fragment>
        <div id="bind-contact-email" className="setting-item">
          <h3 className="setting-item-heading">{gettext('Contact email')}</h3>
          <div className="from-group">
            <p className="mb-2">{showText}</p>
            {enableUserSetContactEmail &&
              <button className="btn btn-outline-primary" onClick={this.onToggleContactDialog}>{buttonValue}</button>
            }
          </div>
        </div>
        {this.state.isShowContactDialog &&
          <ModalPortal>
            <SetContactEmailDialog contactEmail={contactEmail} onBind={this.onBind} toggle={this.onToggleContactDialog} />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

BindContactEmail.propTypes = propTypes;

export default BindContactEmail;
