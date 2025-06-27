import React from 'react';
import PropTypes from 'prop-types';
import { PROJECT_ICON_LIST, PROJECT_ICON_COLORS } from '../../../constants';

function ProjectIcon(props) {
  return (
    <div className={props.className || 'table-icon'}>
      <span className="table-icon-content" style={{ backgroundColor: props.dtableColor || PROJECT_ICON_COLORS[0] }}>
        <i className={`project-icon icon-color-white ${props.dtableIcon || PROJECT_ICON_LIST[0]} project-icon-style`}></i>
      </span>
    </div>
  );
}

ProjectIcon.propTypes = {
  dtableColor: PropTypes.string,
  dtableIcon: PropTypes.string,
  className: PropTypes.string
};

export default ProjectIcon;

