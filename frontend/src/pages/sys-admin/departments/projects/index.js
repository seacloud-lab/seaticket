import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading } from '../../../../components';
import { gettext } from '../../../../constants';
import Item from './item';
import { Utils } from '../../../../utils/utils';
import { sysAdminServiceApi } from '../../../../api/sys-admin-service-api';

const propTypes = {
  groupID: PropTypes.string,
};

class Projects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      projects: [],
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    this.listProjects();
  }

  listProjects = () => {
    const { groupID } = this.props;
    sysAdminServiceApi.sysAdminListGroupProjects(groupID).then(res => {
      this.setState({
        isLoading: false,
        projects: res.data.tables
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        isLoading: false,
        projects: [],
      });
    });
  };

  deleteProject = (project) => {
    const { groupID } = this.props;
    sysAdminServiceApi.sysAdminDeleteProjectsFromGroup(groupID, project.uuid).then(res => {
      if (res.data.success) {
        const msg = gettext('Successfully delete base {placeholder}').replace('{placeholder}', project.name);
        toaster.success(msg);
        this.listProjects(groupID);
      }
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: this.state.isItemFreezed });
  };

  render() {
    const { isLoading, projects, isItemFreezed } = this.state;
    return (
      <div className="cur-view-subcontainer org-bases">
        <div className="cur-view-content">
          {isLoading && <Loading />}
          {!isLoading && projects.length === 0 && (
            <p className="no-base">{gettext('No bases')}</p>
          )}
          {!isLoading && projects.length > 0 && (
            <table className="table-hover">
              <thead>
                <tr>
                  <th width="5%">{/* icon */}</th>
                  <th width="15%">{gettext('Name')}</th>
                  <th width="30%">ID</th>
                  <th width="10%">{gettext('Rows')}</th>
                  <th width="20%">{gettext('Owner')}</th>
                  <th width="15%">{gettext('Created at')}</th>
                  <th width="5%">{/* Operations*/}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((item, index) => {
                  return (
                    <Item
                      key={index}
                      item={item}
                      isItemFreezed={isItemFreezed}
                      onFreezedItem={this.toggleItemFreezed}
                      onUnfreezedItem={this.toggleItemFreezed}
                      deleteProject={this.deleteProject}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }
}

Projects.propTypes = propTypes;

export default Projects;
