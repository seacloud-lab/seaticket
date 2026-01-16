import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from '@/components';
import { gettext, loginUrl } from '@/constants';
import { Utils } from '@/utils/utils';
import orgAdminAPI from '../api';
import { TopBar, Main } from '../main-panel';
import UserInfo from './user-info';

import './index.css';

const { orgID } = window.org.pageOptions;

class UserProfile extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: ''
    };
  }

  componentDidMount() {
    const email = decodeURIComponent(this.props.email);
    orgAdminAPI.orgAdminGetOrgUserInfo(orgID, email).then((res) => {
      this.setState(Object.assign({
        loading: false
      }, res.data));
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: gettext('User not found')
          });
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  }

  updateName = (name) => {
    this.setState({
      name: name
    });
  };

  updateContactEmail = (contactEmail) => {
    this.setState({
      contact_email: contactEmail
    });
  };

  disable2FA = () => {
    const email = decodeURIComponent(this.props.email);
    orgAdminAPI.orgAdminDeleteTwoFactorAuth(orgID, email).then(res => {
      this.setState({
        has_default_device: false
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleForce2fa = (e) => {
    const email = decodeURIComponent(this.props.email);
    const checked = e.target.checked;
    orgAdminAPI.orgAdminSetForceTwoFactorAuth(orgID, email, checked).then(res => {
      this.setState({
        is_force_2fa: checked
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel}/>
        <Main
          title={(
            <ul className="nav">
              <li className="nav-item active">
                <span className="nav-link pt-0 pb-0 active">{gettext('Profile')}</span>
              </li>
            </ul>
          )}
          titleClassName="cur-view-path org-user-nav tab-nav-container"
        >
          <UserInfo
            data={this.state}
            updateName={this.updateName}
            updateContactEmail={this.updateContactEmail}
            disable2FA={this.disable2FA}
            toggleForce2fa={this.toggleForce2fa}
          />
        </Main>
      </>
    );
  }
}

UserProfile.propTypes = {
  email: PropTypes.string,
  onCloseSidePanel: PropTypes.func,
};

export default UserProfile;
