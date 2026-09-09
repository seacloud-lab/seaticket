import React from 'react';
import { Dropdown } from 'reactstrap';
import PropTypes from 'prop-types';
import { CustomizeDropdownItem, CustomizeDropdownMenu, CustomizeDropdownMoreToggle } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';

const propTypes = {
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
};

class ExterLinkOpMenu extends React.Component {

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
      case 'Visit':
        translateResult = gettext('Visit');
        break;
      case 'Delete':
        translateResult = gettext('Delete');
        break;
      case 'Copy to clipboard':
        translateResult = gettext('Copy to clipboard');
        break;
      default:
        break;
    }

    return translateResult;
  };

  render() {
    let operations = ['Visit', 'Copy to clipboard', 'Delete'];

    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <CustomizeDropdownMoreToggle isOpen={this.state.isItemMenuShow} />
        <CustomizeDropdownMenu className="mr-2">
          {operations.map((item, index) => {
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

ExterLinkOpMenu.propTypes = propTypes;

export default ExterLinkOpMenu;
