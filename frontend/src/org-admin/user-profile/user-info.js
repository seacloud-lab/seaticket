import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { IconButton, CenteredLoading, CenteredError } from '@/components';
import { enableUserSetContactEmail, gettext } from '@/constants';
import SetUserName from './set-user-name';
import SetUserContactEmail from './set-user-contact-email';
import SetUserQuota from './set-user-quota';

const { orgID, twoFactorAuthEnabled } = window.org.pageOptions;

class UserInfo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isSetNameDialogOpen: false,
      isSetContactEmailDialogOpen: false,
      isSetQuotaDialogOpen: false,
    };
  }

  toggleSetNameDialog = () => {
    this.setState({
      isSetNameDialogOpen: !this.state.isSetNameDialogOpen
    });
  };

  toggleSetContactEmailDialog = () => {
    this.setState({
      isSetContactEmailDialogOpen: !this.state.isSetContactEmailDialogOpen
    });
  };

  toggleSetQuotaDialog = () => {
    this.setState({
      isSetQuotaDialogOpen: !this.state.isSetQuotaDialogOpen
    });
  };

  render() {
    const {
      loading, errorMsg,
      avatar_url, email, contact_email,
      name, quota_total, has_default_device, is_force_2fa
    } = this.props.data;
    const { isSetNameDialogOpen, isSetContactEmailDialogOpen, isSetQuotaDialogOpen } = this.state;

    if (loading) {
      return (<CenteredLoading />);
    }
    if (errorMsg) {
      return <CenteredError>{errorMsg}</CenteredError>;
    }
    return (
      <Fragment>
        <dl className="mt-0">
          <dt className="info-item-heading">{gettext('Avatar')}</dt>
          <dd>
            <img src={avatar_url} width="80" height="80" className="rounded" alt="" />
          </dd>

          <dt className="info-item-heading">{gettext('Name')}</dt>
          <dd>
            {name || '--'}
            <IconButton icon="rename" title={gettext('Edit')} aria-label={gettext('Edit')} className="admin-edit-inline-small-btn" onClick={this.toggleSetNameDialog} />
          </dd>

          <dt className="info-item-heading">{gettext('Contact email')}</dt>
          <dd>
            {contact_email || '--'}
            {enableUserSetContactEmail && (
              <IconButton icon="rename" title={gettext('Edit')} aria-label={gettext('Edit')} className="admin-edit-inline-small-btn" onClick={this.toggleSetContactEmailDialog} />
            )}
          </dd>

          {twoFactorAuthEnabled &&
            <Fragment>
              <dt className="info-item-heading">{gettext('Two-Factor Authentication')}</dt>
              <dd className="info-item-content">
                {has_default_device ?
                  <FormGroup>
                    <p className="mb-1">{gettext('Enabled')}</p>
                    <Button onClick={this.props.disable2FA}>{gettext('Disable Two-Factor Authentication')}</Button>
                  </FormGroup> :
                  <FormGroup>
                    <p className="mb-1">{gettext('Disabled')}</p>
                    <Button disabled={true}>{gettext('Disable Two-Factor Authentication')}</Button>
                  </FormGroup>
                }
                <FormGroup check>
                  <Label check className="position-relative">
                    <Input type="checkbox" checked={is_force_2fa} onChange={this.props.toggleForce2fa} />
                    <span>{gettext('Force Two-Factor Authentication')}</span>
                  </Label>
                </FormGroup>
              </dd>
            </Fragment>
          }
        </dl>
        {isSetNameDialogOpen && (
          <SetUserName
            orgID={orgID}
            email={email}
            name={name}
            updateName={this.props.updateName}
            toggleDialog={this.toggleSetNameDialog}
          />
        )}
        {isSetContactEmailDialogOpen && (
          <SetUserContactEmail
            orgID={orgID}
            email={email}
            contactEmail={contact_email}
            updateContactEmail={this.props.updateContactEmail}
            toggleDialog={this.toggleSetContactEmailDialog}
          />
        )}
        {isSetQuotaDialogOpen && (
          <SetUserQuota
            orgID={orgID}
            email={email}
            quotaTotal={quota_total}
            updateQuota={this.props.updateQuota}
            toggleDialog={this.toggleSetQuotaDialog}
          />
        )}
      </Fragment>
    );
  }
}

UserInfo.propTypes = {
  data: PropTypes.object.isRequired,
  updateName: PropTypes.func.isRequired,
  updateContactEmail: PropTypes.func.isRequired,
  updateQuota: PropTypes.func.isRequired,
  disable2FA: PropTypes.func.isRequired,
  toggleForce2fa: PropTypes.func.isRequired,
};

export default UserInfo;
