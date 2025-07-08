import React from 'react';
import PropTypes from 'prop-types';
import GroupTrashProjects from './group-trash-projects';
import { Loading } from '../../../components';

function GroupTrashProjectList(props) {
  const { groupID, isLoading, trashList, restoreProject } = props;
  if (isLoading) {
    return <Loading />;
  }
  return (
    <div className="manage-trash-projects">
      <GroupTrashProjects
        groupID={groupID}
        trashList={trashList}
        restoreProject={restoreProject}
      />
    </div>
  );
}

GroupTrashProjectList.propTypes = {
  groupID: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  trashList: PropTypes.array.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

export default GroupTrashProjectList;
