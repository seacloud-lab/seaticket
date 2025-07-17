import React from 'react';
import PropTypes from 'prop-types';
import { Icon } from '../../../components';

const propTypes = {
  options: PropTypes.array.isRequired,
  permission: PropTypes.string,
  toggle: PropTypes.func,
  setPermission: PropTypes.func,
};

class SelectPermission extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isSelectPermissionModalShow: true,
      permission: props.permission || 'rw'
    };
  }

  onSelectPermissionModalToggle = () => {
    this.setState({
      isSelectPermissionModalShow: !this.state.isSelectPermissionModalShow
    }, () => {
      this.props.toggle();
    });
  };

  onSelectPermission = (event, item) => {
    event.stopPropagation();
    const { permission } = this.state;
    if (permission === item.value) return;
    this.setState({ permission: item.value }, () => {
      this.props.setPermission(item);
    });
  };

  render() {
    const { permission, isSelectPermissionModalShow } = this.state;
    const { options } = this.props;

    return (
      <div className={isSelectPermissionModalShow ? '' : 'd-none'} onClick={this.onSelectPermissionModalToggle}>
        <div className="mobile-operation-menu-bg-layer"></div>
        <div className="mobile-operation-menu select-user-modal">
          <div className="select-user-modal">
            <div className="selected-permission-list">
              {options.map((item) => {
                return (
                  <div className="selected-permission-item" key={`mobile-table-permission-${item.value}`} onClick={(event) => this.onSelectPermission(event, item)} >
                    <div className="selected-permission-title">{item.title}</div>
                    <div className="selected-permission-info">
                      <span className="selected-permission-brief">{item.description}</span>
                      {permission === item.value && (<Icon symbol="check-mark" className="selected-permission-mark" />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

SelectPermission.propTypes = propTypes;

export default SelectPermission;
