import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Label } from 'reactstrap';
import MobileCommonHeader from '../mobile-common-header';
import RightAngle from './right-angle';
import SelectMobileUser from './select-mobile-user';
import SelectMobilePermission from './select-mobile-permission';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  toggle: PropTypes.func,
  options: PropTypes.array.isRequired,
  customSharePermissions: PropTypes.array,
  addTableShare: PropTypes.func,
};

class AddShareUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectedUser: false,
      isShowSelectedPermission: false,
      selectedOptions: [],
      permissionItem: props.options[0],
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  toggleSelectedUser = () => {
    this.setState({ isShowSelectedUser: !this.state.isShowSelectedUser });
  };

  togglePermission = () => {
    this.setState({ isShowSelectedPermission: !this.state.isShowSelectedPermission });
  };

  setPermission = (item) => {
    this.setState({ permissionItem: item });
  };

  setUser = (selectedOptions) => {
    this.setState({ selectedOptions });
  };

  addShareUser = () => {
    const { selectedOptions, permissionItem } = this.state;
    this.props.addTableShare(selectedOptions, permissionItem.value);
    this.props.toggle();
  };

  render() {
    const { isShowSelectedUser, isShowSelectedPermission, selectedOptions, permissionItem } = this.state;
    const optionsLength = selectedOptions.length;
    return (
      <Fragment>
        <div className="mobile-share-table">
          <MobileCommonHeader
            title={gettext('Share to user')}
            titleClass='mobile-share-header'
            onLeftClick={this.toggle}
            leftName={<i className="dtable-font dtable-icon-return" />}
            rightName={gettext('Done')}
            onRightClick={this.addShareUser}
            rightStyle={{ color: '#ED7109' }}
          />
          <div className="add-share-user-container">
            <div className="add-share-item">
              <div className="add-share-item-title">
                <Label>{gettext('User')}</Label>
              </div>
              <div className="position-relative">
                <div onClick={this.toggleSelectedUser} className="add-share-item-container">
                  {optionsLength === 0 &&
                    <span className="add-share-item-placeholder">{gettext('Select users')}</span>
                  }
                  {selectedOptions.map((userItem) => {
                    return (
                      <div key={`shareUser${userItem.email}`} className="share-user-collaborator">
                        <span className="collaborator-avatar-container">
                          <img className="collaborator-avatar" src={userItem.avatar_url} alt="" />
                        </span>
                        <span className="collaborator-name">{userItem.name}</span>
                      </div>
                    );
                  })}
                </div>
                <RightAngle />
              </div>
            </div>
            <div className="add-share-item">
              <div className="add-share-item-title">
                <Label>{gettext('Permission')}</Label>
              </div>
              <div className="position-relative">
                <div onClick={this.togglePermission} className="add-share-item-wrapper">{permissionItem.title}</div>
                <RightAngle />
              </div>
            </div>
          </div>
        </div>
        {isShowSelectedUser &&
          <SelectMobileUser
            toggle={this.toggleSelectedUser}
            setUser={this.setUser}
            selectedOptions={selectedOptions}
          />
        }
        {isShowSelectedPermission &&
          <SelectMobilePermission
            toggle={this.togglePermission}
            setPermission={this.setPermission}
            permission={permissionItem.value}
            customSharePermissions={this.props.customSharePermissions}
            options={this.props.options}
          />
        }
      </Fragment>
    );
  }
}

AddShareUser.propTypes = propTypes;

export default AddShareUser;
