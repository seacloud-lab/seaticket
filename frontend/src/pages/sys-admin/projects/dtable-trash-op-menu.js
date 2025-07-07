import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';

const propTypes = {
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

class DTableTrashOpMenu extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemMenuShow: false
    };
  }

  onRestoreProject = (e) => {
    let operation = Utils.getEventData(e, 'op');
    this.props.restoreProject(operation);
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
      case 'Restore':
        translateResult = gettext('Restore');
        break;
      default:
        break;
    }

    return translateResult;
  };

  render() {
    let operations = ['Restore',];

    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <DropdownToggle
          tag="a"
          role="button"
          className="attr-action-icon dtable-font dtable-icon-more-vertical"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.isItemMenuShow}
        />
        <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu mr-2">
          {operations.map((item, index ) => {
            return (<DropdownItem key={index} data-op={item} onClick={this.onRestoreProject}>{this.translateOperations(item)}</DropdownItem>);
          })}
        </DropdownMenu>
      </Dropdown>
    );
  }
}

DTableTrashOpMenu.propTypes = propTypes;

export default DTableTrashOpMenu;
