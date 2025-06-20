import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Label } from 'reactstrap';
import MobileCommonHeader from '../mobile-common-header';
import RightAngle from './right-angle';
import SelectMobileGroup from './select-mobile-group';
import SelectMobilePermission from './select-mobile-permission';
import { gettext } from '../../../../constants/config';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  addTableShare: PropTypes.func,
  options: PropTypes.array.isRequired,
  customSharePermissions: PropTypes.array,
};

class AddShareGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectedGroup: false,
      isShowSelectedPermission: false,
      permission: 'rw',
      selectedOptions: [],
      permissionItem: props.options[0],
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  toggleSelectedGroup = () => {
    this.setState({ isShowSelectedGroup: !this.state.isShowSelectedGroup });
  };

  togglePermission = () => {
    this.setState({ isShowSelectedPermission: !this.state.isShowSelectedPermission });
  };

  setPermission = (item) => {
    this.setState({ permissionItem: item });
  };

  setGroup = (selectedOptions) => {
    this.setState({ selectedOptions });
  };

  addShareGroup = () => {
    const { selectedOptions, permissionItem } = this.state;
    this.props.addTableShare(selectedOptions, permissionItem.value);
    this.props.toggle();
  };

  render() {
    const { isShowSelectedPermission, isShowSelectedGroup, selectedOptions, permissionItem } = this.state;
    const optionsLength = selectedOptions.length;

    return (
      <Fragment>
        <div className="mobile-share-table">
          <MobileCommonHeader
            title={gettext('Share to group')}
            titleClass='mobile-share-header'
            onLeftClick={this.toggle}
            leftName={<i className="dtable-font dtable-icon-return" />}
            rightName={gettext('Done')}
            onRightClick={this.addShareGroup}
            rightStyle={{ color: '#ED7109' }}
          />
          <div className="add-share-user-container">
            <div className="add-share-item">
              <div className="add-share-item-title">
                <Label>{gettext('Group')}</Label>
              </div>
              <div className='position-relative'>
                <div onClick={this.toggleSelectedGroup} className="add-share-item-container">
                  {optionsLength === 0 &&
                    <span className="add-share-item-placeholder">{gettext('Select groups')}</span>
                  }
                  {optionsLength > 0 && selectedOptions.map((groupItem) => {
                    return (
                      <div key={`shareGroup${groupItem.value}`} className="share-table-group">
                        <span className="group-name">{groupItem.label}</span>
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
        {isShowSelectedGroup &&
          <SelectMobileGroup
            toggle={this.toggleSelectedGroup}
            setGroup={this.setGroup}
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

AddShareGroup.propTypes = propTypes;

export default AddShareGroup;
