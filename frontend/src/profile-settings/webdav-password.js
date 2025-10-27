import React from 'react';
import { toaster, ModalPortal, IconButton } from '@/components';
import { gettext } from '@/constants';
import profileSettingsAPI from './api';
import { Utils } from '@/utils/utils';
import UpdateWebdavPassword from './update-webdav-password';

const { webdavPasswd } = window.app.pageOptions;

class WebdavPassword extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      password: webdavPasswd || '',
      isPasswordVisible: false,
      isDialogOpen: false
    };
  }

  togglePasswordVisible = () => {
    this.setState({
      isPasswordVisible: !this.state.isPasswordVisible
    });
  };

  updatePassword = (password) => {
    profileSettingsAPI.updateWebdavSecret(password).then((res) => {
      this.toggleDialog();
      this.setState({
        password: password
      });
      toaster.success(gettext('Password updated'));
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      this.toggleDialog();
      toaster.danger(errorMsg);
    });
  };

  toggleDialog = () => {
    this.setState({
      isDialogOpen: !this.state.isDialogOpen
    });
  };

  render() {
    const { password, isPasswordVisible } = this.state;
    return (
      <React.Fragment>
        <div id="update-webdav-passwd" className="setting-item">
          <h3 className="setting-item-heading">{gettext('WebDav password')}</h3>
          {password ? (
            <React.Fragment>
              <div className="d-flex align-items-center">
                <label className="m-0 mr-2">{gettext('Password:')}</label>
                <input className="border-0 mr-1" type="text" value={isPasswordVisible ? password : '**********'} readOnly={true} size={Math.max(password.length, 10)} />
                <IconButton icon={this.state.isPasswordVisible ? 'eye' : 'eye-slash'} onClick={this.togglePasswordVisible} />
              </div>
              <button className="btn btn-outline-primary mt-2" onClick={this.toggleDialog}>{gettext('Update')}</button>
            </React.Fragment>
          ) : (
            <button className="btn btn-outline-primary" onClick={this.toggleDialog}>{gettext('Set password')}</button>
          )}
        </div>
        {this.state.isDialogOpen && (
          <ModalPortal>
            <UpdateWebdavPassword
              password={this.state.password}
              updatePassword={this.updatePassword}
              toggle={this.toggleDialog}
            />
          </ModalPortal>
        )}
      </React.Fragment>
    );
  }
}

export default WebdavPassword;
