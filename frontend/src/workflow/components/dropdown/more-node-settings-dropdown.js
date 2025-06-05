import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button } from 'reactstrap';
import TaskNodesPopover from '../popover/task-nodes-popover';

const gettext = window.gettext;

class MoreNodeSettingsDropdown extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isDropdownOpen: false,
      isShowNextNodesDialog: false,
    };
  }

  toggleDropdown = () => {
    this.setState({ isDropdownOpen: !this.state.isDropdownOpen });
  };

  toggleNextNodePopover = () => {
    this.setState({ isShowNextNodesDialog: !this.state.isShowNextNodesDialog });
  };

  render() {
    const { isDropdownOpen, isShowNextNodesDialog } = this.state;
    const { otherNodes } = this.props;

    return (
      <>
        <Dropdown toggle={this.toggleDropdown} isOpen={isDropdownOpen}>
          <DropdownToggle
            tag="div"
            role="button"
            data-toggle="dropdown"
            className="workflow-transfer-next-node-dropdown-toggle ml-4"
          >
            <Button color="outline-primary" id="workflow-more-node-settings-button">
              {gettext('More')}
            </Button>
          </DropdownToggle>
          <DropdownMenu className="dtable-dropdown-menu dropdown-menu task-dropdown-menu">
            <DropdownItem onClick={this.toggleNextNodePopover}>
              {gettext('Move to node...')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
        {isShowNextNodesDialog && (
          <TaskNodesPopover
            target="workflow-more-node-settings-button"
            nodes={otherNodes}
            onToggle={this.toggleNextNodePopover}
            onMoveTaskNode={this.props.onMoveTaskNode}
          />
        )}
      </>
    );
  }
}

MoreNodeSettingsDropdown.propTypes = {
  otherNodes: PropTypes.array,
  onMoveTaskNode: PropTypes.func,
};

export default MoreNodeSettingsDropdown;
