import React from 'react';
import { toaster } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import { gettext, mediaUrl, logoPath } from '../../utils/constants';

import '../../css/org-logo-form.css';

const { csrfToken } = window.app.pageOptions;
const { orgID } = window.org.pageOptions;

class OrgLogoForm extends React.Component {

  constructor(props) {
    super(props);
    this.fileInput = React.createRef();
    this.state = {
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

    orgAdminServiceApi.orgAdminUpdateOrgLogo(orgID, file).then((res) => {
      toaster.success(gettext('Logo updated'));
      window.location.reload();
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  onDeleteLogo = () => {
    orgAdminServiceApi.orgAdminDeleteOrgLogo(orgID).then((res) => {
      toaster.success(gettext('Logo deleted'));
      window.location.reload();
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  openFileInput = () => {
    this.fileInput.current.click();
  };

  handleMouseEnter = () => {
    if (!this.state.isEditShown) {
      this.setState({ isEditShown: true });
    }
  };

  handleMouseLeave = () => {
    this.setState({
      isEditShown: false
    });
  };

  render() {
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <div className="org-logo-form row">
        <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
        <label className="col-md-3 col-form-label">{gettext('Logo')}</label>
        <div className="col-md-9 position-relative" onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <div className="org-logo-image">
            <img src={logoUrl} alt=""/>
          </div>
          <span className="org-logo-image-tip">{gettext('Recommend image size: 256 x 64 px')}</span>
          <input type="file" name="avatar" className="d-none" onChange={this.fileInputChange} ref={this.fileInput} />
          {this.state.isEditShown &&
            <div className="org-logo-mask" onClick={this.openFileInput} onMouseLeave={this.handleMouseLeave}>{'+'}</div>
          }
        </div>
      </div>
    );
  }
}

export default OrgLogoForm;
