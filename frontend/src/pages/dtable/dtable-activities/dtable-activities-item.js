import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from '../../../utils/dayjs';
import { gettext, siteRoot } from '../../../utils/constants';
import DTableItem from '../dtable-item';
import ActivityDetailList from './activity-detail-list';

const propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  activities: PropTypes.array.isRequired,
};

class DtableActivityItem extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isActivityDetailshow: false,
    };
  }

  activityDetailToggle = () => {
    this.setState({ isActivityDetailshow: !this.state.isActivityDetailshow });
  };

  onOpenDTable = () => {
    const { item } = this.props;
    if (item.workspace_id) {
      const url = siteRoot + 'workspace/' + item.workspace_id + '/dtable/' + item.dtable_name + '/';
      window.open(url);
    }
  };

  render() {
    let { item, index, activities } = this.props;
    let {
      dtable_name, dtable_uuid, workspace_id, insert_row, modify_row, delete_row, op_date,
    } = item;

    let isShowDate = true;
    if (index > 0) {
      let lastEventTime = activities[index - 1].op_date;
      isShowDate = dayjs(op_date).isSame(lastEventTime, 'day') ? false : true;
    }

    return (
      <Fragment>
        {isShowDate &&
          <tr className="activities-base-date">
            <td colSpan={2} className="border-top-0">{dayjs(op_date).format('YYYY-MM-DD')}</td>
          </tr>
        }
        <tr className="activities-base-detail">
          <td className="text-secondary">
            <div className="activities-base-content">
              <DTableItem dtableColor={item.dtable_color} dtableIcon={item.dtable_icon} />
              <span className="activities-table-name" onClick={this.onOpenDTable}>{dtable_name}</span>
            </div>
          </td>
          <td className="text-secondary">
            <span className="activities-base-operation" onClick={this.activityDetailToggle}>
              {insert_row > 0 &&
                <span>
                  {gettext('inserted {inserted_row} rows').replace('{inserted_row}', insert_row)}
                  {(modify_row > 0 || delete_row > 0) ? ' | ' : ''}
                </span>
              }
              {modify_row > 0 &&
                <span>
                  {gettext('modified {modified_row} rows').replace('{modified_row}', modify_row)}
                  {(delete_row > 0) ? ' | ' : ''}
                </span>
              }
              {delete_row > 0 &&
                <span>
                  {gettext('deleted {deleted_row} rows').replace('{deleted_row}', delete_row)}
                </span>
              }
            </span>
          </td>
        </tr>
        {this.state.isActivityDetailshow &&
          <ActivityDetailList
            dtableUuid={dtable_uuid}
            workspaceId={workspace_id}
            dtableName={dtable_name}
            opDate={op_date}
            activityDetailToggle={this.activityDetailToggle}
          />
        }
      </Fragment>
    );
  }
}

DtableActivityItem.propTypes = propTypes;

export default DtableActivityItem;
