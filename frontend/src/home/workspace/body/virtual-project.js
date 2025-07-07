import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import Base from '../../models/base';
import { Utils, validateName } from '../../../utils/utils';
import ProjectIcon from './project-icon';
import { ProjectSettingPopover } from '../../popover';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object,
  createBlankProject: PropTypes.func,
  hideVirtualDtable: PropTypes.func,
};

class VirtualDtable extends React.Component {

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
        this.props.hideVirtualDtable();
      });
    }).catch((error) => {
      this.handleError(error);
      this.props.hideVirtualDtable();
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
    const { name, icon, bgColor } = this.state;
    return (
      <div
        className={'virtual-table project-item tr-highlight'}
        id="create-project"
      >
        <ProjectIcon bgColor="" icon="" />
        <div className="project-name">{gettext('Untitled project')}</div>
        {this.state.isDataLoaded && (
          <ProjectSettingPopover
            placement="bottom-start"
            popoverClassName="virtual-project-settings"
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

VirtualDtable.propTypes = propTypes;

export default VirtualDtable;
