import React from 'react';
import PropTypes from 'prop-types';
import { PopoverBody } from 'reactstrap';
import CustomizePopover from '../../../components/customize-popover';
import { gettext } from '../../../constants';

import './project-item-popover.css';

class ProjectItemPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
    };
  }

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  onShareProjectToggle = () => {
    this.props.onShareProjectToggle();
    this.props.onToggle();
  };

  onProjectSettingsToggle = () => {
    this.props.onProjectSettingsToggle();
    this.props.onToggle();
  };

  onDeleteProjectToggle = () => {
    this.props.onDeleteProjectToggle();
    this.props.onToggle();
  };

  render() {
    const { target } = this.props;
    return (
      <CustomizePopover
        target={target}
        placement="right-start"
        popoverClassName="project-item-popover"
        hidePopover={this.props.onToggle}
        hidePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
      >
        <PopoverBody className="project-item-popover-content">
          {(
            <>
              <button className="dropdown-item project-item-operation" onClick={this.onShareProjectToggle}>
                <i className="project-item-operation-icon dtable-font dtable-icon-share"></i>
                {gettext('Share')}
              </button>
              <button className="dropdown-item project-item-operation" onClick={this.onProjectSettingsToggle}>
                <i className="project-item-operation-icon dtable-font dtable-icon-edit"></i>
                {gettext('Edit')}
              </button>
              <button className="dropdown-item project-item-operation" onClick={this.onDeleteProjectToggle}>
                <i className="project-item-operation-icon dtable-font dtable-icon-delete"></i>
                {gettext('Delete')}
              </button>
            </>
          )}
        </PopoverBody>
      </CustomizePopover>
    );
  }
}

ProjectItemPopover.propTypes = {
  target: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default ProjectItemPopover;
