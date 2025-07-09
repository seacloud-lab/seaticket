import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import Base from '../../models/base';
import { Utils, validateName } from '../../../utils/utils';
import { ProjectSettingPopover } from '../../popover';
import { PROJECT_BACKGROUND_COLOR_MAP, DEFAULT_COLOR } from '../constants';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object,
  createBlankProject: PropTypes.func,
  hideVirtualProject: PropTypes.func,
};

class VirtualProject extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: gettext('Untitled project'),
      icon: '',
      bgColor: '',
      isChange: true,
      isDataLoaded: false,
      baseCreated: [],
    };
  }

  componentDidMount() {
    let baseCreated = [];
    seaQAAPI.getAccountInfo().then((res) => {
      let obj = {};
      obj.value = 'personal';
      obj.email = res.data.email;
      obj.label = 'Personal';
      baseCreated.push(obj);
      seaQAAPI.listGroups().then((res) => {
        for (let i = 0 ; i < res.data.length; i++) {
          let obj = {};
          obj.value = res.data[i].id;
          obj.email = res.data[i].id + '@seafile_group';
          obj.label = res.data[i].name;
          baseCreated.push(obj);
        }
        this.setState({ baseCreated, isDataLoaded: true });
      }).catch((err) => {
        this.handleError(err);
        this.props.hideVirtualProject();
      });
    }).catch((error) => {
      this.handleError(error);
      this.props.hideVirtualProject();
    });
  }

  onCreate = () => {
    const { name, icon, bgColor, baseCreated, isChange } = this.state;
    if (!isChange) return;
    const { currentWorkspace } = this.props;
    let response = validateName(name);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    let email;
    if (currentWorkspace) {
      for (let i = 0; i < baseCreated.length; i++) {
        if ((currentWorkspace.type === 'personal' && baseCreated[i].value === 'personal') ||
          (currentWorkspace.type === 'group' && baseCreated[i].value === currentWorkspace.group_id)) {
          email = baseCreated[i].email;
          break;
        }
      }
    }
    seaQAAPI.createProject(response.message, email, icon, bgColor, null).then((res) => {
      let newProject = new Base(res.data.project);
      this.props.createBlankProject(newProject);
    }).catch((error) => {
      this.setState({ isChange: false });
      this.handleError(error);
    });
  };

  handleError = (err) => {
    let errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onColorChange = (bgColor) => {
    this.setState({ bgColor, isChange: true });
  };

  onIconChange = (icon) => {
    this.setState({ icon, isChange: true });
  };

  onNameChange = (name) => {
    this.setState({ name, isChange: true });
  };

  render() {
    let { className = '', style = {}, currentWorkspace } = this.props;
    const { name, icon, bgColor } = this.state;
    const backgroundColorMap = PROJECT_BACKGROUND_COLOR_MAP;
    return (
      <div
        className={`project-item d-flex ${className}`}
        id="create-project"
        style={{
          ...style,
          backgroundColor: backgroundColorMap[bgColor] || backgroundColorMap[DEFAULT_COLOR],
        }}
      >
        <div className="project-item-icon-more d-flex">
          <div
            className="project-item-icon d-flex align-items-center justify-content-center"
            style={{ backgroundColor: bgColor || DEFAULT_COLOR }}
          >
            <i className={`project-item-icon-font icon-color-white project-icon project-icon-style ${icon || 'icon-worksheet'}`}></i>
          </div>
        </div>
        <div className="project-item-name" title={name}>
          {name}
        </div>
        <div className="project-item-group text-truncate">
          <i className='table-workspace-icon dtable-font dtable-icon-collaborator'></i>
          {currentWorkspace.name}
        </div>
        {this.state.isDataLoaded && (
          <ProjectSettingPopover
            popoverClassName="virtual-project-settings"
            placement="bottom-start"
            target="create-project"
            onToggle={this.onCreate}
            name={name}
            bgColor={bgColor}
            icon={icon}
            onColorChange={this.onColorChange}
            onIconChange={this.onIconChange}
            onNameChange={this.onNameChange}
          />
        )}
      </div>
    );
  }
}

VirtualProject.propTypes = propTypes;

export default VirtualProject;
