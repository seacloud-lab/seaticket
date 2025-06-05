import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AppFormSettings from './app-form-settings';
import AppFormElementSettings from './app-form-element-settings';

class AppFormSettingsPanel extends Component {

  render() {
    const { settingElement, onColumnChanged, onSave, updateSettingElement, currentColumns, elementsOrder,
      staticElements, onColumnRequiredChanged, tables, tableId } = this.props;

    if (settingElement) {
      return (
        <AppFormElementSettings
          column={currentColumns.find(column => column.key === settingElement.key)}
          settingElement={settingElement}
          onColumnChanged={onColumnChanged}
          updateSettingElement={updateSettingElement}
          tables={tables}
          currentColumns={currentColumns}
          elementsOrder={elementsOrder}
          staticElements={staticElements}
          tableId={tableId}
          onSave={onSave}
          onColumnRequiredChanged={onColumnRequiredChanged}
        />
      );
    }
    return (
      <AppFormSettings {...this.props} />
    );
  }
}

AppFormSettingsPanel.propTypes = {
  tableId: PropTypes.string,
  settingElement: PropTypes.object,
  currentColumns: PropTypes.array,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  tables: PropTypes.array,
  onSave: PropTypes.func,
  onColumnChanged: PropTypes.func,
  updateSettingElement: PropTypes.func,
  onColumnRequiredChanged: PropTypes.func,
};

export default AppFormSettingsPanel;
