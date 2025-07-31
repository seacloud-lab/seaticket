import React from 'react';
import PropTypes from 'prop-types';
import { PopoverBody } from 'reactstrap';
import CustomizePopover from '../../../components/customize-popover';
import { gettext } from '../../../constants';

import './project-item-popover.css';
import { Icon } from '../../../components';

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
        className="project-item-popover"
        hidePopover={this.props.onToggle}
        hidePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
        modifiers={[
          { name: 'preventOverflow', options: { boundary: document.body } },
          { name: 'offset', options: { offset: [0, 0] } }
        ]}
      >
        <PopoverBody className="project-item-popover-content">
          {(
            <>
              <button className="dropdown-item project-item-operation" onClick={this.onShareProjectToggle}>
                <Icon symbol="share" className="project-item-operation-icon" />
                {gettext('Share')}
              </button>
              <button className="dropdown-item project-item-operation" onClick={this.onProjectSettingsToggle}>
                <Icon symbol="rename" className="project-item-operation-icon" />
                {gettext('Edit name and icon')}
              </button>
              <button className="dropdown-item project-item-operation" onClick={this.onDeleteProjectToggle}>
                <Icon symbol="delete" className="project-item-operation-icon" />
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
