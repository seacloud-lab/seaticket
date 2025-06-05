import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { gettext, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import AppsTableItem from './apps-table-item';


const propTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  hasNextPage: PropTypes.bool.isRequired,
  curPerPage: PropTypes.number,
  currentPage: PropTypes.number.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  listAppsByPage: PropTypes.func.isRequired,
  onChangeAppStatus: PropTypes.func.isRequired,
  onDeleteApp: PropTypes.func.isRequired,
  onDisableAppOpenAccess: PropTypes.func.isRequired,
  onEnableAppOpenAccess: PropTypes.func.isRequired
};


class AppsTable extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listAppsByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listAppsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, currentPage, hasNextPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-plugin.png`} text={gettext('No apps')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="15%">{gettext('Name')}</th>
                <th width="20%">ID</th>
                <th width="20%">{gettext('Related base')}</th>
                <th width="10%">{gettext('Type')}</th>
                <th width="20%"><span className="pl-2">{gettext('Created at')}</span></th>
                <th width="5%">{gettext('Count')}</th>
                <th width="10%">{/* Operations*/}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<AppsTableItem
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  onChangeAppStatus={this.props.onChangeAppStatus}
                  onDeleteApp={this.props.onDeleteApp}
                  onDisableAppOpenAccess={this.props.onDisableAppOpenAccess}
                  onEnableAppOpenAccess={this.props.onEnableAppOpenAccess}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={currentPage}
            hasNextPage={hasNextPage}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
          />
        </Fragment>
      );

      return items.length ? table : emptyTip;
    }
  }
}

AppsTable.protoTypes = propTypes;

export default AppsTable;
