import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { CustomizeDropdownMoreToggle } from '../../../components';

const propTypes = {
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
  handled: PropTypes.bool.isRequired,
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
      case 'Resolved':
        translateResult = gettext('Mark as resolved');
        break;
      case 'Unresolved':
        translateResult = gettext('Mark as unresolved');
        break;
      default:
        break;
    }
    return translateResult;
  };

  getOperations = () => {
    if (this.props.handled) {
      return ['Unresolved'];
    } else {
      return ['Resolved'];
    }
  };

  render() {
    let operations = this.getOperations();
    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} />
        <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu mr-2">
          {operations.map((item, index ) => {
            return (<DropdownItem key={index} data-op={item} onClick={this.onMenuItemClick}>{this.translateOperations(item)}</DropdownItem>);
          })}
        </DropdownMenu>
      </Dropdown>
    );
  }
}

OpMenu.propTypes = propTypes;

export default OpMenu;
