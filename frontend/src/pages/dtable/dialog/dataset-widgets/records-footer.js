import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';

function RecordsFooter(props) {
  const { hasMore, recordsCount } = props;
  let recordsCountText = gettext('No record');
  if (recordsCount > 1) {
    recordsCountText = gettext('{records_count} records').replace('{records_count}', recordsCount);
  } else if (recordsCount === 1) {
    recordsCountText = gettext('1 record');
  }
  const tip = hasMore ? gettext('Scroll down to load more') : gettext('All records loaded');
  return (
    <div className="dtable-dataset-result-count">
      <div className="position-absolute">
        {recordsCountText} <span className='tip'>({tip})</span>
      </div>
    </div>
  );
}

RecordsFooter.propTypes = {
  hasMore: PropTypes.bool,
  recordsCount: PropTypes.number,
};

export default RecordsFooter;
