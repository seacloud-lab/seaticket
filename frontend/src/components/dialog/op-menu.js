import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'reactstrap';
import { Utils } from '../../utils/utils';
import CustomizeDropdownMoreToggle from '../customize-dropdown-more-toggle';
import CustomizeDropdownMenu from '../customize-dropdown-menu';
import CustomizeDropdownItem from '../customize-dropdown-item';

const propTypes = {
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
  operations: PropTypes.array.isRequired,
  translateOperations: PropTypes.func.isRequired
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
        <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} className="w-5 h-5 sf-dropdown-toggle" />
        <CustomizeDropdownMenu className="my-1 mr-2">
          {operations.map((item, index ) => {
            return (<CustomizeDropdownItem key={index} data-op={item} onClick={this.onMenuItemClick}>{translateOperations(item)}</CustomizeDropdownItem>);
          })}
        </CustomizeDropdownMenu>
      </Dropdown>
    );
  }
}

OpMenu.propTypes = propTypes;

export default OpMenu;
