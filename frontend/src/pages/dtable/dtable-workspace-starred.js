import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';
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
      tableList: [],
    };
  }

  componentDidMount() {
    const { starredWorkspace } = this.props;
    const { tableList } = this.getSortedWorkspaceStarredContent(starredWorkspace);
    this.setState({ tableList });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!ObjectUtils.isSameObject(nextProps.starredWorkspace, this.props.starredWorkspace)) {
      const { tableList } = this.getSortedWorkspaceStarredContent(nextProps.starredWorkspace);
      this.setState({ tableList });
    }
  }

  getSortedWorkspaceStarredContent = (starredWorkspace) => {
    const { table_list = [] } = starredWorkspace;
    return {
      tableList: table_list.sort((a, b) => compareTwoString(a.name, b.name)),
    };
  };

  unstarDTable = (table) => {
    dtableWebAPI.unstarDTable(table.uuid).then(() => {
      this.props.onUnstarDTable(table);
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    const { personalWorkspace, groupWorkspaceList, noBaseTip } = this.props;
    const { tableList } = this.state;
    if (!tableList.length) {
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
          {tableList.map((table, index) => {
            const path = getWorkspaceName(table, workspaces);
            return (
              <DTableItemStarred key={index} table={table} unstarDTable={this.unstarDTable} path={path}/>
            );
          })}
        </div>
      </div>
    );
  }
}

DTableWorkspaceStarred.propTypes = propTypes;

export default DTableWorkspaceStarred;
