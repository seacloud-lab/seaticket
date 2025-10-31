import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'reactstrap';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { CustomizeDropdownItem, CustomizeDropdownMenu, CustomizeDropdownMoreToggle } from '@/components';

const propTypes = {
  canUpdateAdmin: PropTypes.bool,
  isAdmin: PropTypes.bool,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
};

class OpMenu extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemMenuShow: false
    };
  }

  onMenuItemClick = (e) => {
    let operation = Utils.getEventData(e, 'op');
    this.props.onMenuItemClick(operation);
  };

  onDropdownToggleClick = (e) => {
    this.toggleOperationMenu(e);
  };

  toggleOperationMenu = (e) => {
    this.setState(
      { isItemMenuShow: !this.state.isItemMenuShow },
      () => {
        if (this.state.isItemMenuShow) {
          this.props.onFreezedItem();
        } else {
          this.props.onUnfreezedItem();
        }
      }
    );
  };

  translateOperations = (item) => {
    let translateResult = '';
    switch (item) {
      case 'Delete':
        translateResult = gettext('Delete');
        break;
      case 'Reset password':
        translateResult = gettext('Reset password');
        break;
      case 'Set as admin':
        translateResult = gettext('Set as admin');
        break;
      case 'Unset as admin':
        translateResult = gettext('Unset as admin');
        break;
      default:
        break;
    }

    return translateResult;
  };

  render() {
    const operations = ['Delete', 'Reset password'];
    const { canUpdateAdmin, isAdmin } = this.props;
    if (canUpdateAdmin) {
      if (isAdmin === true) {
        operations.unshift('Unset as admin');
      } else {
        operations.unshift('Set as admin');
      }
    }
    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} />
        <CustomizeDropdownMenu className="mt-2 mr-2">
          {operations.map((item, index ) => {
            return (
              <CustomizeDropdownItem key={index} data-op={item} onClick={this.onMenuItemClick}>
                {this.translateOperations(item)}
              </CustomizeDropdownItem>
            );
          })}
        </CustomizeDropdownMenu>
      </Dropdown>
    );
  }
}

OpMenu.propTypes = propTypes;

export default OpMenu;
