import React from 'react';
import PropTypes from 'prop-types';
import { gettext, trashCleanExpireDays, mediaUrl } from '../../../constants';
import { EmptyTip, Icon, Loading, MobileCommonHeader } from '../../../components';
import DeletedGroupProjectItem from './deleted-group-project-item';

import './index.css';

function GroupTrashView(props) {
  const { trashList, toggle, groupID, restoreProject, isLoading } = props;
  return (
    <div className="group-trash-view w-100 h-100 position-fixed" >
      <MobileCommonHeader
        title={gettext('Trash')}
        leftName={<Icon symbol="return" />}
        onLeftClick={toggle}
      />
      {trashList.length > 0 && (
        <>
          <div className="group-trash-tips">
            <p>
              {gettext('Tip: projects deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
            </p>
          </div>
          <div className="trash-view-content-header d-flex">
            <p className="trash-view-project-name">{gettext('Name')}</p>
            <p className="trash-view-project-deleted-time">{gettext('Deleted at')}</p>
          </div>
        </>
      )}
      <div className="group-trash-view-content" style={{ height: document.body.clientHeight - 50 }}>
        {isLoading && <Loading />}
        {!isLoading && trashList.length === 0 &&
          <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No deleted projects')} />
        }
        {!isLoading && trashList.length > 0 && trashList.map(projectItem => {
          return (
            <DeletedGroupProjectItem
              key={projectItem.id}
              projectItem={projectItem}
              groupID={groupID}
              restoreProject={restoreProject}
            />
          );
        })}
      </div>
    </div>
  );
}

GroupTrashView.propTypes = {
  groupID: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  trashList: PropTypes.array.isRequired,
  toggle: PropTypes.func.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

export default GroupTrashView;
