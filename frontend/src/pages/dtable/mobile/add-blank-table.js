import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Input } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from './mobile-common-header';
import { DTABLE_ICON_LIST, DTABLE_ICON_COLORS } from '../../../constants/dtable-icon';
import { gettext } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { validateName } from '../../../utils/utils';

import '../../../css/mobile/add-blank-table.css';

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onCreateProjectToggle: PropTypes.func.isRequired,
  createProject: PropTypes.func.isRequired,
};

class AddBlankTable extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      dtableIcon: DTABLE_ICON_LIST[0],
      dtableColor: DTABLE_ICON_COLORS[0],
      tableName: '',
      options: [],
    };
  }

  componentDidMount() {
    let options = [];
    dtableWebAPI.getAccountInfo().then((res) => {
      let obj = {};
      obj.value = 'personal';
      obj.email = res.data.email;
      obj.label = 'personal';
      options.push(obj);
      dtableWebAPI.listGroups().then((res) => {
        for (let i = 0 ; i < res.data.length; i++) {
          let obj = {};
          obj.value = res.data[i].name;
          obj.email = res.data[i].id + '@seafile_group';
          obj.label = res.data[i].name;
          options.push(obj);
        }
        this.setState({ options: options });
      });
    });
  }

  handleChange = (e) => {
    if (!e.target.value.trim()) {
      this.setState({ isSubmitBtnActive: false });
    } else {
      this.setState({ isSubmitBtnActive: true });
    }

    this.setState({
      tableName: e.target.value,
    }) ;
  };

  onCreateProjectToggle = () => {
    this.props.onCreateProjectToggle();
  };

  onCreateTable = () => {
    const { tableName, options, dtableIcon, dtableColor } = this.state;
    const { currentWorkspace } = this.props;
    let response = validateName(tableName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }

    let email;
    if (currentWorkspace) {
      for (let i = 0; i < options.length; i++) {
        if ((currentWorkspace.type === 'personal' && options[i].value === 'personal') ||
          (currentWorkspace.type === 'group' && options[i].value === currentWorkspace.name)) {
          email = options[i].email;
          break;
        }
      }
    }
    this.props.createProject(response.message, email, dtableIcon, dtableColor);
    this.props.onCreateProjectToggle();
  };

  onIconChange = (dtableIcon) => {
    if (dtableIcon === this.state.dtableIcon) return;
    this.setState({ dtableIcon });
  };

  onColorChange = (dtableColor) => {
    if (dtableColor === this.state.dtableColor) return;
    this.setState({ dtableColor });
  };

  renderColorSettings = () => {
    let { dtableColor } = this.state;
    return (
      <div className="row dtable-color-content">
        {DTABLE_ICON_COLORS.map((color, index) => {
          return (
            <div key={index} className="dtable-color-item" onClick={() => this.onColorChange(color)}>
              <label className="colorinput">
                <span className="colorinput-color" style={{ backgroundColor: color }}>
                  {color === dtableColor && <i className="dtable-icon-color-check dtable-font dtable-icon-check-mark"></i>}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    let { dtableColor, dtableIcon } = this.state;

    return (
      <div className="row dtable-icon-content mt-4">
        {DTABLE_ICON_LIST.map((icon, index) => {
          let isSelected = icon === dtableIcon;
          return (
            <div key={index} className="dtable-icon-item" onClick={() => this.onIconChange(icon)} style={{ backgroundColor: isSelected ? dtableColor : '' }}>
              <label className="colorinput dtable-icon-input">
                <i className={classnames('base-font dtable-icon-style', { [icon]: icon, 'dtable-icon-color-white': isSelected })}></i>
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
          title={gettext('Create a blank project')}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onLeftClick={this.onCreateProjectToggle}
          onRightClick={this.onCreateTable}
        />

        <Input className="create-table-input" placeholder={gettext('Enter name')} value={this.state.tableName} onChange={this.handleChange} />
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

AddBlankTable.propTypes = propTypes;

export default AddBlankTable;
