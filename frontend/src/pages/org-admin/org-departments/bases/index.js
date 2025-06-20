import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import Loading from '../../../../components/loading';
import BaseItem from './base-item';
import { orgAdminServiceApi } from '../../../../api/org-admin-service-api';
import { Utils } from '../../../../utils/utils';
import { gettext, orgID } from '../../../../constants';

const propTypes = {
  groupID: PropTypes.string,
};

class Bases extends Component {

  constructor(props) {
    super(props);
    this.state = {
      dtables: [],
      isLoading: true,
    };
  }

  componentDidMount() {
    this.listDTables();
  }

  listDTables = () => {
    const { groupID } = this.props;
    orgAdminServiceApi.orgAdminListGroupDTables(orgID, groupID).then(res => {
      this.setState({
        dtables: res.data.tables,
        isLoading: false,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        dtables: [],
        isLoading: false,
      });
    });
  };

  deleteDTable = (dtable) => {
    const { groupID } = this.props;
    orgAdminServiceApi.orgAdminDeleteDTableFromGroup(orgID, groupID, dtable.uuid).then(res => {
      if (res.data.success) {
        const msg = gettext('Successfully delete base {placeholder}').replace('{placeholder}', dtable.name);
        toaster.success(msg);
        this.listDTables(groupID);
      }
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { isLoading, dtables } = this.state;
    return (
      <div className="cur-view-subcontainer org-bases">
        <div className="cur-view-content">
          {isLoading && <Loading />}
          {!isLoading && dtables.length === 0 && (
            <p className="no-base">{gettext('No bases')}</p>
          )}
          {!isLoading && dtables.length > 0 && (
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
                {dtables.map((item, index) => {
                  return (
                    <BaseItem
                      key={index}
                      item={item}
                      deleteDTable={this.deleteDTable}
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

Bases.propTypes = propTypes;

export default Bases;
