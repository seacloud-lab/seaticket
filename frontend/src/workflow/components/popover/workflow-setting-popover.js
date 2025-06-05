import React from 'react';
import { PopoverBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { WORKFLOW_ICONS, WORKFLOW_COLORS } from '../../constants';
import DTablePopover from '../../../components/dtable-popover';

import '../../css/popover/workflow-setting-popover.css';

export default class WorkflowSettingPopover extends React.Component {

  static propTypes = {
    target: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    icon: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
  };

  onChangeName = (e) => {
    const name = e.target.value;
    if (name === this.props.name) return;
    this.props.onChange({ name });
  };

  onColorChange = (color) => {
    if (color === this.props.color) return;
    this.props.onChange({ color });
  };

  onIconChange = (icon) => {
    if (icon === this.props.icon) return;
    this.props.onChange({ icon });
  };

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  renderName = () => {
    return (
      <div className="workflow-icon-settings-name">
        <input
          type="text"
          className="form-control workflow-icon-settings-name-input"
          value={this.props.name}
          onChange={this.onChangeName}
          autoFocus={true}
        />
      </div>
    );
  };

  renderColorSettings = () => {
    const { color } = this.props;
    const selectedColor = color || WORKFLOW_COLORS[0];
    return (
      <div className="row workflow-color-content">
        {WORKFLOW_COLORS.map((color, index) => {
          return (
            <div
              key={index}
              className="workflow-color-item"
              onClick={() => this.onColorChange(color)}
            >
              <label className="colorinput">
                <span className="colorinput-color" style={{ backgroundColor: color }}>
                  {color === selectedColor && (
                    <i className="workflow-icon-color-check dtable-font dtable-icon-check-mark"></i>
                  )}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    const { icon, color } = this.props;
    const selectedColor = color || WORKFLOW_COLORS[0];
    const selectedIcon = icon || WORKFLOW_ICONS[0];
    return (
      <div className="row workflow-icon-content">
        {WORKFLOW_ICONS.map((icon, index) => {
          const isSelected = icon === selectedIcon;
          return (
            <div
              key={index}
              className="workflow-icon-item"
              onClick={() => this.onIconChange(icon)}
              style={{ backgroundColor: isSelected ? selectedColor : '' }}
            >
              <label className="colorinput workflow-icon-input">
                <i
                  className={classnames('base-font workflow-icon-style', {
                    [icon]: icon,
                    'dtable-icon-color-white': isSelected
                  })}
                >
                </i>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    const { target } = this.props;
    return (
      <DTablePopover
        placement="right-start"
        target={target}
        hideDTablePopover={this.props.onToggle}
        hideDTablePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
        popoverClassName="workflow-icon-settings-popover"
      >
        <PopoverBody className="workflow-icon-settings-content">
          {this.renderName()}
          {this.renderColorSettings()}
          {this.renderIconSettings()}
        </PopoverBody>
      </DTablePopover>
    );
  }
}
