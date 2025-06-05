import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import DtableActivityItem from './dtable-activities-item';
import { gettext, mediaUrl } from '../../../utils/constants';

const propTypes = {
  isLoadingMore: PropTypes.bool.isRequired,
  activities: PropTypes.array.isRequired,
};

class DtableActivitiesList extends Component {

  render() {
    let { activities, isLoadingMore } = this.props;
    if (activities.length === 0) {
      return (
        <DTableEmptyTip text={gettext('No activities')} src={`${mediaUrl}img/no-items-tip.png`} />
      );
    }
    return (
      <Fragment>
        <table className="table-hover table-thead-hidden activity-table">
          <thead>
            <tr>
              <th width="45%"></th>
              <th width="55%"></th>
            </tr>
          </thead>
          <tbody>
            {activities.map((item, index) => {
              if (item.dtable_name) {
                return (
                  <DtableActivityItem
                    key={`activity-item-${index}`}
                    item={item}
                    index={index}
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
  }
}

DtableActivitiesList.propTypes = propTypes;

export default DtableActivitiesList;
