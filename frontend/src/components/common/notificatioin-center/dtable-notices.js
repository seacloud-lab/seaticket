import React from 'react';
import PropTypes from 'prop-types';
import { siteRoot } from '../../../utils/constants';
import DTableItem from '../../../pages/dtable/dtable-item';

import '../../../css/notices.css';

class DTableNotices extends React.Component {

  render() {
    const { dtableNoticeDetails } = this.props;
    return (
      <div className="notification-bases">
        {dtableNoticeDetails.map((item, index) => {
          const { workspace_id, dtable_name, dtable_icon, dtable_color, unseen_count } = item;
          if (unseen_count === 0) return null;
          const link = siteRoot + 'workspace/' + workspace_id + '/dtable/' + dtable_name + '/';
          return (
            <div className="notification-base-item d-flex align-items-center justify-content-between" key={index}>
              <div className="d-flex align-items-center">
                <DTableItem dtableIcon={dtable_icon} dtableColor={dtable_color} />
                <span className="base-name text-truncate">
                  <a href={link} target="_blank" rel="noopener noreferrer">{dtable_name}</a>
                </span>
              </div>
              <span className="unseen">{unseen_count}</span>
            </div>
          );
        })}
      </div>
    );
  }
}

DTableNotices.propTypes = {
  dtableNoticeDetails: PropTypes.array,
};

export default DTableNotices;
