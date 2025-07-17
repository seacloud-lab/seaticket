import React from 'react';
import PropTypes from 'prop-types';
import { Icon, MobileCommonHeader } from '../../../components';
import { gettext } from '../../../constants';

const propTypes = {
  isShowDeleteBtn: PropTypes.bool,
  permission: PropTypes.string,
  options: PropTypes.array.isRequired,
  toggle: PropTypes.func.isRequired,
  setPermission: PropTypes.func,
  onHandleDeleteShare: PropTypes.func,
};

class SelectPermission extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      permission: props.permission || 'rw',
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  onSelectedPermission = (permission) => {
    if (this.state.permission === permission) return;
    this.setState({ permission });
  };

  setPermission = () => {
    const { permission } = this.state;
    this.props.setPermission(permission);
    this.props.toggle();
  };

  onHandleDelete = () => {
    this.props.onHandleDeleteShare();
    this.props.toggle();
  };

  render() {
    const { isShowDeleteBtn, options } = this.props;
    const { permission } = this.state;
    return (
      <div className="mobile-share-project">
        <MobileCommonHeader
          title={gettext('Select permission')}
          titleClass='mobile-share-header'
          onLeftClick={this.toggle}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onRightClick={this.setPermission}
          rightStyle={{ color: '#ED7109' }}
        />
        <div className="selected-permission-box">
          <div className="selected-permission">
            <div className="selected-permission-header">
              {gettext('Select permission')}
            </div>
            <div className="selected-permission-list">
              {options.map((optionItem) => {
                return (
                  <div className="selected-permission-item" key={`selected-permission${optionItem.value}`} onClick={this.onSelectedPermission.bind(this, optionItem.value)}>
                    <div className="selected-permission-title">{optionItem.title}</div>
                    <div className="selected-permission-info">
                      <span className="selected-permission-brief">{optionItem.description}</span>
                      {permission === optionItem.value && (<Icon className="selected-permission-mark" symbol="check-mark" />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {isShowDeleteBtn &&
            <div className="delete-permission-btn" onClick={this.onHandleDelete}>
              {gettext('Delete')}
            </div>
          }
        </div>
      </div>
    );
  }
}

SelectPermission.propTypes = propTypes;

export default SelectPermission;
