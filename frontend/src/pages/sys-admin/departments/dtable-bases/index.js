import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../../utils/constants';
import Loading from '../../../../components/loading';
import BaseItem from './base-item';
import { Utils } from '../../../../utils/utils';
import { sysAdminServiceApi } from '../../../../api/sys-admin-service-api';

const propTypes = {
  groupID: PropTypes.string,
};

class Bases extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      dtables: [],
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    this.listDTables();
  }

  listDTables = () => {
    const { groupID } = this.props;
    sysAdminServiceApi.sysAdminListGroupDTables(groupID).then(res => {
      this.setState({
        isLoading: false,
        dtables: res.data.tables
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({
        isLoading: false,
        dtables: [],
      });
    });
  };

  deleteDTable = (dtable) => {
    const { groupID } = this.props;
    sysAdminServiceApi.sysAdminDeleteDTableFromGroup(groupID, dtable.uuid).then(res => {
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

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: this.state.isItemFreezed });
  };

  render() {
    const { isLoading, dtables, isItemFreezed } = this.state;
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
                      isItemFreezed={isItemFreezed}
                      onFreezedItem={this.toggleItemFreezed}
                      onUnfreezedItem={this.toggleItemFreezed}
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
