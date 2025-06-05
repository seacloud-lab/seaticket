import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import '../../css/dropdown/workflow-node-dropdown.css';

const gettext = window.gettext;

class WorkflowNodeDropdown extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isDropdownOpen: false,
    };
  }

  toggleDropdown = () => {
    this.setState({ isDropdownOpen: !this.state.isDropdownOpen });
  };

  onCopyNode = (event) => {
    event.stopPropagation();
    this.props.onCopyNode();
  };

  onDeleteNode = (event) => {
    event.stopPropagation();
    this.props.onDeleteNode();
  };

  render() {
    const { isDropdownOpen } = this.state;
    return (
      <Dropdown
        className="workflow-node-dropdown"
        isOpen={isDropdownOpen}
        toggle={this.toggleDropdown}
      >
        <DropdownToggle tag="span" role="button" data-toggle="dropdown" className="workflow-node-dropdown-toggle">
          <i
            className="workflow-node-dropdown-toggle-icon dtable-font dtable-icon-more-vertical"
            title={gettext('More operations')}
            aria-label={gettext('More operations')}
          >
          </i>
        </DropdownToggle>
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu task-dropdown-menu">
          <DropdownItem onClick={this.onCopyNode}>
            <i className="dtable-font dtable-icon-copy workflow-node-dropdown-item-icon"></i>
            <span className="workflow-node-dropdown-item-text">{gettext('Copy node')}</span>
          </DropdownItem>
          <DropdownItem onClick={this.onDeleteNode}>
            <i className="dtable-font dtable-icon-delete workflow-node-dropdown-item-icon"></i>
            <span className="workflow-node-dropdown-item-text">{gettext('Delete node')}</span>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

WorkflowNodeDropdown.propTypes = {
  onCopyNode: PropTypes.func.isRequired,
  onDeleteNode: PropTypes.func.isRequired,
};

export default WorkflowNodeDropdown;
