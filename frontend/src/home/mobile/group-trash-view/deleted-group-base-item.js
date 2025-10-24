import React, { useState } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, ProjectIcon } from '../../../components';
import { seaQAAPI } from '../../../api/web-api';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { formatWithTimezone } from '@/sea-metadata/constants/column/format';


function DeletedGroupBaseItem(props) {

  const [loading, setLoading] = useState(false);
  const { baseItem, groupID } = props;

  async function restoreGroupTrashProject() {
    const { name, uuid } = baseItem;
    setLoading(true);
    try {
      await seaQAAPI.restoreGroupTrashProject(uuid, groupID);
      setLoading(false);
      props.restoreProject(baseItem);
      const msg = gettext('Successfully restored {name}.').replace('{name}', name);
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
    <div className="deleted-group-base-item-container">
      <div className="base-item-icon">
        <ProjectIcon bgColor={baseItem.color} icon={baseItem.icon} />
      </div>
      <div className="base-item-title text-truncate">{baseItem.name}</div>
      <div className="base-item-delete-time" title={formatWithTimezone(baseItem.delete_time)}>
        {dayjs(baseItem.delete_time).format('YYYY-MM-DD HH:mm:ss')}
      </div>
      <div className="restore-base-button text-truncate">
        {loading ?
          <span className="loading-icon loading-tip" />
          :
          <span onClick={restoreGroupTrashProject}>{gettext('Restore')}</span>
        }
      </div>
    </div>
  );
}

DeletedGroupBaseItem.propTypes = {
  baseItem: PropTypes.object.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

export default DeletedGroupBaseItem;
