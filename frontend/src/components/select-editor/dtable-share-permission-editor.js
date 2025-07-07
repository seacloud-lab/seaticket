import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import CustomizeReactSelect from '../customize-react-select';
import { Utils } from '../../utils/utils';
import { gettext, canUseAdvancedPerms } from '../../constants/config';

import '../../css/select-editor.css';

const propTypes = {
  isTextMode: PropTypes.bool.isRequired,
  isEditIconShow: PropTypes.bool.isRequired,
  currentPermission: PropTypes.string.isRequired,
  customSharePermissions: PropTypes.array,
  onPermissionChanged: PropTypes.func.isRequired,
  onAddCustomSharePermission: PropTypes.func,
};

class DtableSharePermissionEditor extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      options: this.getOption(props),
    };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.onHideSelect);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.customSharePermissions !== this.props.customSharePermissions) {
      this.setState({ options: this.getOption(nextProps) });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onHideSelect);
  }

  getOption = (props) => {
    const permissions = ['rw', 'r'];
    const permissionsOptions = permissions.map(permission => {
      return {
        value: permission,
        label: (
          <div>
            {this.translatePermission(permission)}
            <div className="permission-editor-explanation seatable-tip-default">{this.translateExplanation(permission)}</div>
          </div>
        )
      };
    });

    let customSharePermissionsOptions = this.getCustomSharePermissionsOptions(props);
    permissionsOptions.push(...customSharePermissionsOptions);
    return permissionsOptions;
  };

  getCustomSharePermissionsOptions = (props) => {
    let { customSharePermissions, onAddCustomSharePermission } = props;
    if (!Array.isArray(customSharePermissions)) return [];
    let customSharePermissionsOptions = customSharePermissions.map((customSharePermission) => {
      const { id, name, description } = customSharePermission;
      return {
        value: `c-${id}`,
        title: name,
        label: <div>{name}<div className="permission-editor-explanation">{description}</div></div>
      };
    });
    if (canUseAdvancedPerms && onAddCustomSharePermission) {
      customSharePermissionsOptions.push(
        {
          value: 'addCustomSharePermission',
          isDisabled: true,
          label: (
            <div className="btn-add-custom-permission" onClick={this.onAddCustomSharePermission}>
              <i className="dtable-font dtable-icon-add-table"></i>
              <span>{gettext('Add custom permission')}</span>
            </div>
          )
        }
      );
    }
    return customSharePermissionsOptions;
  };

  translatePermission = (permission) => {
    return Utils.sharePerms(permission);
  };

  translateExplanation = (explanation) => {
    return Utils.dtableSharePermsExplanation(explanation);
  };

  onHideSelect = (event) => {
    if (this.editor && event && !this.editor.contains(event.target)) {
      this.setState({ isEditing: false });
    }
  };

  onEditPermission = (e) => {
    e.nativeEvent.stopImmediatePropagation();
    this.setState({ isEditing: true });
  };

  onPermissionChanged = (e) => {
    if (e.value !== this.props.currentPermission) {
      this.props.onPermissionChanged(e.value);
    }
    this.setState({ isEditing: false });
  };

  onSelectHandler = (e) => {
    e.nativeEvent.stopImmediatePropagation();
  };

  onAddCustomSharePermission = () => {
    this.props.onAddCustomSharePermission();
  };

  render() {
    const { currentPermission, isTextMode } = this.props;
    const { options, isEditing } = this.state;

    let optionTranslation;
    if (currentPermission.startsWith('c-')) {
      let currentCustomPermission = options.find(option => option.value === currentPermission);
      optionTranslation = currentCustomPermission ? currentCustomPermission.title : '';
    } else {
      optionTranslation = this.translatePermission(currentPermission);
    }

    return (
      <div onClick={this.onSelectHandler} className="permission-editor" ref={ref => this.editor = ref}>
        {(isTextMode && !isEditing) ?
          <Fragment>
            <span>{optionTranslation}</span>
            {this.props.isEditIconShow &&
              <span title={gettext('Edit')} className="dtable-font dtable-icon-rename attr-action-icon" onClick={this.onEditPermission}></span>
            }
          </Fragment>
          :
          <CustomizeReactSelect
            className="permission-editor-select"
            classNamePrefix="permission-editor"
            options={options}
            placeholder={optionTranslation}
            onChange={this.onPermissionChanged}
            value={options.find(option => option.value === currentPermission) || {}}
            menuPortalTarget="#wrapper"
          />
        }
      </div>
    );
  }
}

DtableSharePermissionEditor.propTypes = propTypes;

export default DtableSharePermissionEditor;
