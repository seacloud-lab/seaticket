import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import ObjectUtils from '../../utils/object-utils';
import DTableItemStarred from './dtable-item-starred';
import getWorkspaceName from './utils/get-workspace-name';
import { compareTwoString } from './utils/compare-two-string';

const gettext = window.gettext;

const propTypes = {
  starredWorkspace: PropTypes.object.isRequired,
  onUnstarDTable: PropTypes.func.isRequired,
  personalWorkspace: PropTypes.object,
  groupWorkspaceList: PropTypes.array.isRequired,
  noBaseTip: PropTypes.object,
};

class DTableWorkspaceStarred extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      projectList: [],
    };
  }

  componentDidMount() {
    const { starredWorkspace } = this.props;
    const { projectList } = this.getSortedWorkspaceStarredContent(starredWorkspace);
    this.setState({ projectList });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!ObjectUtils.isSameObject(nextProps.starredWorkspace, this.props.starredWorkspace)) {
      const { projectList } = this.getSortedWorkspaceStarredContent(nextProps.starredWorkspace);
      this.setState({ projectList });
    }
  }

  getSortedWorkspaceStarredContent = (starredWorkspace) => {
    const { project_list = [] } = starredWorkspace;
    return {
      projectList: project_list.sort((a, b) => compareTwoString(a.name, b.name)),
    };
  };

  render() {
    const { personalWorkspace, groupWorkspaceList, noBaseTip } = this.props;
    const { projectList } = this.state;
    if (!projectList.length) {
      return noBaseTip || '';
    }

    const isDesktop = Utils.isDesktop();
    const workspaces = personalWorkspace ? [].concat(personalWorkspace, groupWorkspaceList) : groupWorkspaceList;

    return (
      <div className="workspace">
        <div className={`${isDesktop ? '' : 'table-mobile-heading '}table-heading`}>
          <span className="table-workspace-icon dtable-font dtable-icon-star"></span>
          <span>{gettext('Favorites')}</span>
        </div>
        <div className={`${isDesktop ? 'table-item-container' : 'table-mobile-item-container'}`}>
          {projectList.map((project, index) => {
            const path = getWorkspaceName(project, workspaces);
            return (
              <DTableItemStarred key={index} table={project} path={path}/>
            );
          })}
        </div>
      </div>
    );
  }
}

DTableWorkspaceStarred.propTypes = propTypes;

export default DTableWorkspaceStarred;
