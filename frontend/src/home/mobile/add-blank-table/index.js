import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Input } from 'reactstrap';
import { toaster, MobileCommonHeader } from '../../../components';
import { PROJECT_ICON_LIST, PROJECT_ICON_COLORS } from '../../../constants';
import { gettext } from '../../../constants/config';
import { seaQAAPI } from '../../../api/web-api';
import { validateName } from '../../../utils/utils';

import './index.css';

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onCreateProjectToggle: PropTypes.func.isRequired,
  createProject: PropTypes.func.isRequired,
};

class AddBlankTable extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      icon: PROJECT_ICON_LIST[0],
      bgColor: PROJECT_ICON_COLORS[0],
      tableName: '',
      options: [],
    };
  }

  componentDidMount() {
    let options = [];
    seaQAAPI.getAccountInfo().then((res) => {
      let obj = {};
      obj.value = 'personal';
      obj.email = res.data.email;
      obj.label = 'personal';
      options.push(obj);
      seaQAAPI.listGroups().then((res) => {
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
    const { tableName, options, icon, bgColor } = this.state;
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
    this.props.createProject(response.message, email, icon, bgColor);
    this.props.onCreateProjectToggle();
  };

  onIconChange = (icon) => {
    if (icon === this.state.icon) return;
    this.setState({ icon });
  };

  onColorChange = (bgColor) => {
    if (bgColor === this.state.bgColor) return;
    this.setState({ bgColor });
  };

  renderColorSettings = () => {
    let { bgColor } = this.state;
    return (
      <div className="row dtable-color-content">
        {PROJECT_ICON_COLORS.map((color, index) => {
          return (
            <div key={index} className="dtable-color-item" onClick={() => this.onColorChange(color)}>
              <label className="colorinput">
                <span className="colorinput-color" style={{ backgroundColor: color }}>
                  {color === bgColor && <i className="dtable-icon-color-check dtable-font dtable-icon-check-mark"></i>}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    let { bgColor, icon } = this.state;

    return (
      <div className="row dtable-icon-content mt-4">
        {PROJECT_ICON_LIST.map((iconItem, index) => {
          let isSelected = iconItem === icon;
          return (
            <div key={index} className="dtable-icon-item" onClick={() => this.onIconChange(iconItem)} style={{ backgroundColor: isSelected ? bgColor : '' }}>
              <label className="colorinput dtable-icon-input">
                <i className={classnames('project-icon project-icon-style', { [iconItem]: iconItem, 'icon-color-white': isSelected })}></i>
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
