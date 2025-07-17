import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownItem } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { CustomizeDropdownMoreToggle } from '../../../components';

const propTypes = {
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
  translateOperations: PropTypes.func,
  operations: PropTypes.array
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

  render() {
    const { operations, translateOperations } = this.props;
    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} />
        <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu mt-2 mr-2">
          {operations.map((item, index ) => {
            return (<DropdownItem key={index} data-op={item} onClick={this.onMenuItemClick}>{translateOperations(item)}</DropdownItem>);
          })}
        </DropdownMenu>
      </Dropdown>
    );
  }
}

OpMenu.propTypes = propTypes;

export default OpMenu;
