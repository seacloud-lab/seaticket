import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { validateName } from '../../utils/utils';

const propTypes = {
  userInfo: PropTypes.object,
  updateUserInfo: PropTypes.func
};

const {
  nameLabel,
  enableUpdateUserInfo,
  enableUserSetContactEmail,
  enableUserSetName,
  enableMemberModifyName,
} = window.app.pageOptions;

class UserBasicInfoForm extends React.Component {

  constructor(props) {
    super(props);
    const {
      contact_email,
      name
    } = this.props.userInfo;
    this.state = {
      contactEmail: contact_email,
      name: name
    };
  }

  handleNameInputChange = (e) => {
    this.setState({
      name: e.target.value
    });
  };

  handleSubmit = (e) => {
    e.preventDefault();
    const response = validateName(this.state.name);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    let data = {};
    if (enableUserSetName) {
      data.name = response.message;
    }
    if (enableUserSetContactEmail) {
      data.contact_email = this.state.contactEmail;
    }
    this.props.updateUserInfo(data);
  };

  render() {
    const { name } = this.state;

    return (
      <form action="" method="post" onSubmit={this.handleSubmit}>

        <div className="form-group row">
          <label className="col-sm-1 col-form-label" htmlFor="name">{nameLabel}</label>
          <div className="col-sm-5">
            <input
              className="form-control"
              id="name"
              type="text"
              name="nickname"
              value={name}
              disabled={!enableUpdateUserInfo || !enableMemberModifyName || !enableUserSetName}
              onChange={this.handleNameInputChange}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-outline-primary offset-sm-1"
          disabled={!enableUpdateUserInfo || !enableMemberModifyName || !enableUserSetName}
        >
          {gettext('Submit')}
        </button>
      </form>
    );
  }
}

UserBasicInfoForm.propTypes = propTypes;

export default UserBasicInfoForm;
