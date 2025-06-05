import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import DtableActivityItemView from './dtable-activities-item-view';

const propTypes = {
  isLoadingMore: PropTypes.bool.isRequired,
  activities: PropTypes.array.isRequired,
  userListMap: PropTypes.object,
  dtableUuid: PropTypes.string,
  workspaceId: PropTypes.number,
};

const DtableActivitiesListView = ({ activities, isLoadingMore, dtableUuid, workspaceId }) => {

  return (
    <Fragment>
      <table className="table-hover table-thead-hidden activity-table activity-table-view">
        <thead>
          <tr>
            <th width="100%"></th>
          </tr>
        </thead>
        <tbody>
          {activities.map((item, index) => {
            if (item.dtable_name) {
              return (
                <DtableActivityItemView
                  key={`dtable-activity-item-view-${index}`}
                  item={item}
                  index={index}
                  dtableUuid={dtableUuid}
                  workspaceId={workspaceId}
                  activities={activities}
                />
              );
            }
            return null;
          })}
        </tbody>
      </table>
      {isLoadingMore ? <span className="loading-icon loading-tip"></span> : ''}
    </Fragment>
  );
};

DtableActivitiesListView.propTypes = propTypes;

export default DtableActivitiesListView;
