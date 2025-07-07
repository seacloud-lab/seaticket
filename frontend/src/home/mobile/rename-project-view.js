import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster, List, InputItem, MobileCommonHeader } from '../../components';
import { PROJECT_ICON_LIST, PROJECT_ICON_COLORS } from '../../constants';
import { gettext } from '../../constants';
import { validateName } from '../../utils/utils';

const propTypes = {
  currentItem: PropTypes.object.isRequired,
  onMobileUpdateItemToggle: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
};

class RenameProjectView extends React.Component {

  constructor(props) {
    super(props);
    const { currentItem } = props;
    this.state = {
      itemIcon: currentItem.icon || PROJECT_ICON_LIST[0],
      itemColor: currentItem.color || PROJECT_ICON_COLORS[0],
      itemName: currentItem.name || '',
    };
  }

  handleChange = (value) => {
    this.setState({ itemName: value });
  };

  onMobileUpdateItemToggle = () => {
    this.props.onMobileUpdateItemToggle();
  };

  onRenameItem = () => {
    const { itemIcon, itemColor } = this.state;
    const { currentItem } = this.props;
    let response = validateName(this.state.itemName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    const newItemName = response.message;
    if (currentItem.color !== itemColor
      || currentItem.icon !== itemIcon
      || currentItem.name !== newItemName
    ) {
      let update = {
        color: itemColor,
        icon: itemIcon,
      };
      if (newItemName !== currentItem.name) {
        update.new_name = newItemName;
      }
      this.props.onUpdateItem(currentItem.name, update);
    }
    this.onMobileUpdateItemToggle();
  };

  onIconChange = (itemIcon) => {
    if (itemIcon === this.state.itemIcon) return;
    this.setState({ itemIcon });
  };

  onColorChange = (itemColor) => {
    if (itemColor === this.state.itemColor) return;
    this.setState({ itemColor });
  };

  renderColorSettings = () => {
    let { itemColor } = this.state;
    const iconColorList = PROJECT_ICON_COLORS;
    return (
      <div className="row dtable-color-content">
        {iconColorList.map((color, index) => {
          return (
            <div key={index} className="dtable-color-item" onClick={() => this.onColorChange(color)}>
              <label className="colorinput">
                <span className="colorinput-color" style={{ backgroundColor: color }}>
                  {color === itemColor && <i className="dtable-icon-color-check dtable-font dtable-icon-check-mark"></i>}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    let { itemColor, itemIcon } = this.state;
    const iconList = PROJECT_ICON_LIST;

    return (
      <div className="row dtable-icon-content mt-4">
        {iconList.map((icon, index) => {
          let isSelected = icon === itemIcon;
          return (
            <div key={index} className="dtable-icon-item" onClick={() => this.onIconChange(icon)} style={{ backgroundColor: isSelected ? itemColor : '' }}>
              <label className="colorinput dtable-icon-input">
                <i className={classnames('project-icon project-icon-style', { [icon]: icon, 'icon-color-white': isSelected })}></i>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    return (
      <div className="add-blank-table">
        <MobileCommonHeader
          title={gettext('Change name and icon')}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onLeftClick={this.onMobileUpdateItemToggle}
          onRightClick={this.onRenameItem}
        />
        <List>
          <InputItem className="create-table-input" clear value={this.state.itemName} onChange={this.handleChange} />
        </List>
        <div className="selected-table-container dtable-icon-settings-popover">
          <span>{gettext('Choose icon and color')}</span>
          <div className="create-base-settings">
            {this.renderColorSettings()}
            {this.renderIconSettings()}
          </div>
        </div>
      </div>
    );
  }
}

RenameProjectView.propTypes = propTypes;

export default RenameProjectView;
