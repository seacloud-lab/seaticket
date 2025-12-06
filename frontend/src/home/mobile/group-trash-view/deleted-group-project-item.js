import React, { useState } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, ProjectIcon } from '@/components';
import homeAPI from '../../api';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

function DeletedGroupProjectItem(props) {

  const [loading, setLoading] = useState(false);
  const { projectItem, groupID } = props;

  async function restoreGroupTrashProject() {
    const { name, uuid } = projectItem;
    setLoading(true);
    try {
      await homeAPI.restoreGroupTrashProject(uuid, groupID);
      setLoading(false);
      props.restoreProject(projectItem);
      const msg = gettext('%s restored').replace('%s', name);
      toaster.success(msg);
    } catch (error) {
      setLoading(false);
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    }
  }

  return (
    <div className="deleted-group-project-item-container">
      <div className="project-item-icon">
        <ProjectIcon bgColor={projectItem.color} icon={projectItem.icon} />
      </div>
      <div className="project-item-title text-truncate">{projectItem.name}</div>
      <div className="project-item-delete-time" title={formatWithTimezone(projectItem.delete_time)}>
        {dayjs(projectItem.delete_time).format('YYYY-MM-DD HH:mm:ss')}
      </div>
      <div className="restore-project-button text-truncate">
        {loading ?
          <span className="loading-icon loading-tip" />
          :
          <span onClick={restoreGroupTrashProject}>{gettext('Restore')}</span>
        }
      </div>
    </div>
  );
}

DeletedGroupProjectItem.propTypes = {
  projectItem: PropTypes.object.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

export default DeletedGroupProjectItem;
