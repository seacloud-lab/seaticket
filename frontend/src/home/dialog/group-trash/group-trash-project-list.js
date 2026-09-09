import React from 'react';
import PropTypes from 'prop-types';
import { Loading } from '../../../components';
import GroupTrashProjects from './group-trash-projects';

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
