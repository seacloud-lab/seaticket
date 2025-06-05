import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { gettext, trashCleanExpireDays, mediaUrl } from '../../../utils/constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import DTableTrashItem from './dtable-trash-item';
import EmptyDTableTrashDialog from '../dialog/empty-dtable-trash-dialog';

const propTypes = {
  isLoading: PropTypes.bool,
  trashDTableList: PropTypes.array,
  restoreDTable: PropTypes.func,
  isTrashEmptyConfirmDialogOpen: PropTypes.bool,
  toggleTrashEmptyConfirmDialog: PropTypes.func,
  handleEmptyTrashTables: PropTypes.func,

};

class DTableTrashList extends Component {

  render() {
    const { isLoading, trashDTableList } = this.props;
    if (isLoading) {
      return (
        <div className="py-8"><Loading /></div>
      );
    }
    if (trashDTableList.length === 0) {
      return (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No deleted bases')} />
      );
    }
    return (
      <Fragment>
        <p className="seatable-tip-default">
          {gettext('Tip: tables deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
        </p>
        <table className="table-hover trash-table">
          <MediaQuery query="(min-width: 767.8px)">
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="45%" title={gettext('Name')} aria-label={gettext('Name')}>{gettext('Name')}</th>
                <th width="40%" title={gettext('Deleted at')} aria-label={gettext('Deleted at')}>{gettext('Deleted at')}</th>
                <th width="10%">{/* Operations*/}</th>
              </tr>
            </thead>
          </MediaQuery>
          <MediaQuery query="(max-width: 767.8px)">
            <thead>
              <tr className="trash-table-col-name-mobile">
                <th width="12%">{/* icon*/}</th>
                <th width="70%">{/* gettext('Name')*/}</th>
                <th width="18%">{/* Operations*/}</th>
              </tr>
            </thead>
          </MediaQuery>
          <tbody>
            {trashDTableList.map((item) => {
              return (
                <DTableTrashItem
                  key={`trash-dtable-${item.id}`}
                  item={item}
                  restoreDTable={this.props.restoreDTable}
                />
              );
            })}
          </tbody>
        </table>
        {this.props.isTrashEmptyConfirmDialogOpen &&
          <EmptyDTableTrashDialog
            emptyTrashCancel={this.props.toggleTrashEmptyConfirmDialog}
            emptyTrashConfirm={this.props.handleEmptyTrashTables}
          />
        }
      </Fragment>
    );
  }
}

DTableTrashList.propTypes = propTypes;

export default DTableTrashList;
