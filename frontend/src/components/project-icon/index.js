import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { PROJECT_ICON_LIST, PROJECT_ICON_COLORS } from '../../constants';

import './index.css';

const ProjectIcon = ({ className, bgColor, icon, size = '' }) => {
  return (
    <div className={classnames('project-icon', className, size)}style={{ backgroundColor: bgColor || PROJECT_ICON_COLORS[0] }}>
      <i className={`project-icon icon-color-white ${icon || PROJECT_ICON_LIST[0]} project-icon-style`}></i>
    </div>
  );
};

ProjectIcon.propTypes = {
  bgColor: PropTypes.string,
  icon: PropTypes.string,
  className: PropTypes.string
};

export default ProjectIcon;

