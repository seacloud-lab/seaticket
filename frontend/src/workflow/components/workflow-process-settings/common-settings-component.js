import React from 'react';
import PropTypes from 'prop-types';

function CommonSettingsComponent(props) {
  return (
    <div className="workflow-app-settings-container">
      <div className="workflow-app-settings-header">
        <div className="workflow-app-settings-header-content">
          {props.header}
        </div>
      </div>
      {props.children}
    </div>
  );
}

CommonSettingsComponent.propTypes = {
  header: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
};

export default CommonSettingsComponent;
