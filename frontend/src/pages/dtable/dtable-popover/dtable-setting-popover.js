import React from 'react';
import { PopoverBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DTABLE_ICON_LIST, DTABLE_ICON_COLORS } from '../../../constants/dtable-icon';
import DtablePopover from '../../../components/dtable-popover';
import { gettext } from '../../../utils/constants';

export default class DtableSettingPopover extends React.Component {

  static propTypes = {
    placement: PropTypes.string,
    popoverClassName: PropTypes.string,
    tableIconSettingsId: PropTypes.string.isRequired,
    onTableIconToggle: PropTypes.func.isRequired,
    dtableName: PropTypes.string.isRequired,
    dtableColor: PropTypes.string,
    dtableIcon: PropTypes.string,
    onColorChange: PropTypes.func.isRequired,
    onIconChange: PropTypes.func.isRequired,
    onNameChange: PropTypes.func.isRequired,
  };

  static defaultProps = {
    placement: 'bottom-end',
    autoFocus: false,
    popoverClassName: '',
  };

  onChangeName = (e) => {
    this.props.onNameChange(e.target.value);
  };

  onColorChange = (dtableColor) => {
    if (dtableColor === this.props.dtableColor) return;
    this.props.onColorChange(dtableColor);
  };

  onIconChange = (dtableIcon) => {
    if (dtableIcon === this.props.dtableIcon) return;
    this.props.onIconChange(dtableIcon);
  };

  onEnter = (e) => {
    e.preventDefault();
    this.props.onTableIconToggle();
  };

  renderBaseName = () => {
    return (
      <div className="dtable-icon-settings-name">
        <input
          type="text"
          className="form-control dtable-icon-settings-name-input"
          value={this.props.dtableName}
          onChange={this.onChangeName}
          autoFocus={true}
          aria-label={gettext('Enter base name')}
          aria-describedby={gettext('Enter a description of the base name')}
        />
      </div>
    );
  };

  renderColorSettings = () => {
    let { dtableColor } = this.props;
    dtableColor = dtableColor || DTABLE_ICON_COLORS[0];
    return (
      <div className="row dtable-color-content">
        {DTABLE_ICON_COLORS.map((color, index) => {
          return (
            <div
              key={index}
              className="dtable-color-item"
              onClick={() => this.onColorChange(color)}
              role="button"
            >
              <span className="colorinput">
                <span
                  className="colorinput-color"
                  style={{ backgroundColor: color }}
                  title={`${gettext('Color')} ${color}`}
                  aria-label={`${gettext('Color')} ${color}`}
                  aria-selected={color === dtableColor}
                >
                  {color === dtableColor &&
                    <i aria-hidden="true" className="dtable-icon-color-check dtable-font dtable-icon-check-mark"></i>
                  }
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    let { dtableIcon, dtableColor } = this.props;
    dtableColor = dtableColor || DTABLE_ICON_COLORS[0];
    dtableIcon = dtableIcon || DTABLE_ICON_LIST[0];
    return (
      <div className="row dtable-icon-content">
        {DTABLE_ICON_LIST.map((icon, index) => {
          let isSelected = icon === dtableIcon;
          return (
            <div
              key={index}
              className="dtable-icon-item"
              onClick={() => this.onIconChange(icon)}
              role="button"
              style={{ backgroundColor: isSelected ? dtableColor : '' }}
              title={`${gettext('Icon')} ${icon}`}
              aria-label={`${gettext('Icon')} ${icon}`}
            >
              <span className="colorinput dtable-icon-input" aria-selected={isSelected}>
                <i aria-hidden="true" className={classnames('base-font dtable-icon-style', { [icon]: icon, 'dtable-icon-color-white': isSelected })}></i>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    return (
      <DtablePopover
        placement={this.props.placement}
        target={this.props.tableIconSettingsId}
        hideDTablePopover={this.props.onTableIconToggle}
        hideDTablePopoverWithEsc={this.props.onTableIconToggle}
        onEnter={this.onEnter}
        hideArrow={true}
        popoverClassName={`dtable-icon-settings-popover ${this.props.popoverClassName}`}
      >
        <PopoverBody className="dtable-icon-settings-content">
          {this.renderBaseName()}
          {this.renderColorSettings()}
          {this.renderIconSettings()}
        </PopoverBody>
      </DtablePopover>
    );
  }
}
