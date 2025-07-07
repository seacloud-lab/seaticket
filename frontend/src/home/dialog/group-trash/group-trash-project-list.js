import React from 'react';
import PropTypes from 'prop-types';
import GroupTrashProjects from './group-trash-projects';
import { Loading } from '../../../components';

function GroupTrashProjectList(props) {
  const { groupID, isLoading, trashDTableList, restoreProject } = props;
  if (isLoading) {
    return <Loading />;
  }
  return (
    <div className="manage-trash-projects">
      <GroupTrashProjects
        groupID={groupID}
        trashDTableList={trashDTableList}
        restoreProject={restoreProject}
      />
    </div>
  );
}

GroupTrashProjectList.propTypes = {
  groupID: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  trashDTableList: PropTypes.array.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

export default GroupTrashProjectList;
