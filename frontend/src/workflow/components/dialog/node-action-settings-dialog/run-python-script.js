import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'reactstrap';
import { DTableSelect } from 'dtable-ui-component';
import { gettext } from '../../../../utils/constants';
import OptionUtils from '../../../../utils/option-utils';

class RunPythonScript extends React.Component {

  constructor(props) {
    super(props);
    const { scripts = [], action } = props;
    const { script_name } = action;
    const pythonScripts = Array.isArray(scripts) ? scripts
      .filter(script => script.type === 'Python')
      .map(script => {
        const { name, url } = script;
        return { key: url.split('scripts/').pop(), name };
      }) : [];
    this.pythonScriptOptions = OptionUtils.generatorKeyLabelOptions(pythonScripts);
    this.state = {
      selectedScriptOption: this.pythonScriptOptions.find(option => option.value === script_name),
    };
  }

  onSaveAction = () => {
    const { action } = this.props;
    const { selectedScriptOption } = this.state;
    const script_name = selectedScriptOption ? selectedScriptOption.value : '';
    const newAction = { ...action, script_name };
    this.props.onUpdateAction(newAction);
  };

  onScriptChanged = (selectedScriptOption) => {
    if (this.state.selectedScriptOption && selectedScriptOption.value === this.state.selectedScriptOption.value) return;
    this.setState({ selectedScriptOption }, () => {
      this.onSaveAction();
    });
  };

  render() {
    const { selectedScriptOption } = this.state;

    return (
      <div className="form-group settings-item">
        <Label className="item-label">{gettext('Script')}</Label>
        <DTableSelect
          value={selectedScriptOption}
          options={this.pythonScriptOptions}
          onChange={this.onScriptChanged}
          placeholder={gettext('Select script')}
          menuPortalTarget={'.workflow-node-action-settings-modal'}
          noOptionsMessage={() => {
            return <span>{gettext('No scripts')}</span>;
          }}
        />
      </div>
    );
  }
}

RunPythonScript.propTypes = {
  action: PropTypes.object.isRequired,
  scripts: PropTypes.array,
  onUpdateAction: PropTypes.func.isRequired,
};

export default RunPythonScript;
