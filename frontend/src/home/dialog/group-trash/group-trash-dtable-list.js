import React from 'react';
import PropTypes from 'prop-types';
import GroupTrashDtables from './group-trash-dtables';
import Loading from '../../../components/loading';

function GroupTrashDtableList(props) {
  const { groupID, isLoading, trashDTableList, restoreDTable } = props;
  if (isLoading) {
    return <Loading />;
  }
  return (
    <div className="manage-trash-dtables">
      <GroupTrashDtables
        groupID={groupID}
        trashDTableList={trashDTableList}
        restoreDTable={restoreDTable}
      />
    </div>
  );
}

GroupTrashDtableList.propTypes = {
  groupID: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  trashDTableList: PropTypes.array.isRequired,
  restoreDTable: PropTypes.func.isRequired,
};

export default GroupTrashDtableList;
