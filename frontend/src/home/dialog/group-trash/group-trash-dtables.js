import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext, trashCleanExpireDays, mediaUrl } from '../../../constants/config';
import { DTableEmptyTip } from 'dtable-ui-component';
import GroupTrashDTablesItem from './group-trash-dtables-item';

const propTypes = {
  trashDTableList: PropTypes.array.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreDTable: PropTypes.func.isRequired,
};

class GroupTrashDtables extends React.Component {

  render() {
    const { trashDTableList, groupID } = this.props;
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
        <table className="trash-dtables">
          <thead>
            <tr>
              <th width="5%">{/* icon*/}</th>
              <th width="45%">{gettext('Name')}</th>
              <th width="40%">{gettext('Deleted at')}</th>
              <th width="10%">{/* Operations*/}</th>
            </tr>
          </thead>
          <tbody>
            {trashDTableList.map((item, index) => {
              return (
                <GroupTrashDTablesItem
                  key={item.id}
                  item={item}
                  groupID={groupID}
                  restoreDTable={this.props.restoreDTable}
                />
              );
            })}
          </tbody>
        </table>
      </Fragment>
    );
  }
}

GroupTrashDtables.propTypes = propTypes;

export default GroupTrashDtables;
