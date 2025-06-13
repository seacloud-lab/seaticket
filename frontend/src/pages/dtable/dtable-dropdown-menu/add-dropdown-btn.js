import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button } from 'reactstrap';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onCreateTableToggle: PropTypes.func.isRequired,
  folder: PropTypes.object,
};

class AddDropdownBtn extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isTableRenaming: false,
      dropdownOpen: false,
      active: false,
    };
  }

  dropdownToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onCreateTableToggle = () => {
    this.props.onCreateTableToggle(this.props.folder);
  };

  render() {
    return (
      <Dropdown
        isOpen={this.state.dropdownOpen}
        toggle={this.dropdownToggle}
        direction="left"
        className="add-base-dropdown-menu"
        aria-label={gettext('More operations')}
      >
        <DropdownToggle
          tag='i'
          role="button"
          className='dropdown-menu-toggle'
          data-toggle="dropdown"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          aria-expanded={this.state.dropdownOpen}
          aria-haspopup={true}
          direction="down"
        >
          <Button color="primary" size="sm">
            <span className='dtable-font dtable-icon-enlarge mr-2' aria-hidden="true"></span>
            <span aria-label={gettext('Create a blank project')}>{gettext('New')}</span>
          </Button>
        </DropdownToggle>
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu dropdown-menu-list large">
          <DropdownItem onClick={this.onCreateTableToggle} >
            <span className="item-icon dtable-font dtable-icon-add-table" aria-hidden="true"></span>
            <span aria-label={gettext('Create a blank project')}>{gettext('Create a blank project')}</span>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

AddDropdownBtn.propTypes = propTypes;

export default AddDropdownBtn;
