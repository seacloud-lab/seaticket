import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DEFAULT_PROJECT_ICON, PROJECT_ICON_COLORS } from '../../constants';

import './index.css';

const ProjectIcon = ({ className, bgColor, icon, size = '' }) => {
  return (
    <div className={classnames('project-item-icon', className, size)}>
      <i
        className={`project-icon ${icon || DEFAULT_PROJECT_ICON} project-icon-style`}
        style={{ color: bgColor || PROJECT_ICON_COLORS[0] }}
        aria-hidden="true"
      >
      </i>
    </div>
  );
};

ProjectIcon.propTypes = {
  bgColor: PropTypes.string,
  icon: PropTypes.string,
  className: PropTypes.string
};

export default ProjectIcon;
