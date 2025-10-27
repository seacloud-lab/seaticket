import React from 'react';
import classnames from 'classnames';
import { toaster, IconButton } from '@/components';
import { gettext } from '@/constants';
import profileSettingsAPI from './api';
import { Utils } from '@/utils/utils';

const { avatarURL, csrfToken } = window.app.pageOptions;

class UserAvatarForm extends React.Component {

  constructor(props) {
    super(props);
    this.fileInput = React.createRef();
    this.form = React.createRef();
    this.state = {
      avatarSrc: avatarURL,
      isEditShown: false
    };
  }

  fileInputChange = () => {

    // no file selected
    if (!this.fileInput.current.files.length) {
      return;
    }

    const file = this.fileInput.current.files[0];
    const fileName = file.name;

    // no file extension
    if (fileName.lastIndexOf('.') === -1) {
      toaster.danger(gettext('Please choose an image file.'), {
        duration: 5
      });
      return false;
    }

    const fileExt = fileName.substr((fileName.lastIndexOf('.') + 1)).toLowerCase();
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif'];
    if (allowedExt.indexOf(fileExt) === -1) {
      const errorMsg = gettext('File extensions can only be {placeholder}.')
        .replace('{placeholder}', allowedExt.join(', '));
      toaster.danger(errorMsg, { duration: 5 });
      return false;
    }

    // file size should be less than 1MB
    if (file.size > 1024 * 1024) {
      const errorMsg = gettext('The file is too large. Allowed maximum size is 1MB.');
      toaster.danger(errorMsg, { duration: 5 });
      return false;
    }

    // this.form.current.submit();
    profileSettingsAPI.updateUserAvatar(file).then((res) => {
      this.setState({
        avatarSrc: res.data.avatar_url
      });
      toaster.success(gettext('Avatar updated'));
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  openFileInput = () => {
    this.fileInput.current.click();
  };

  handleMouseOver = () => {
    this.setState({
      isEditShown: true
    });
  };

  handleMouseOut = () => {
    this.setState({
      isEditShown: false
    });
  };

  render() {
    return (
      <div className="form-group row">
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
        <label className="col-sm-1 col-form-label">{gettext('Avatar:')}</label>
        <div className="col-auto position-relative" onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
          <img src={this.state.avatarSrc} width="80" height="80" alt="" className="user-avatar" />
          <input type="file" name="avatar" className="d-none" onChange={this.fileInputChange} ref={this.fileInput} />
          <IconButton className={classnames('avatar-edit', { 'd-none': !this.state.isEditShown })} icon="rename" onClick={this.openFileInput} />
        </div>
      </div>
    );
  }
}

export default UserAvatarForm;
