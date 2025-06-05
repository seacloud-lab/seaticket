import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { getCellValueDisplayString } from 'dtable-utils';

function LinkTextWidget(props) {
  const { className, rows, linkedDisplayColumn, collaborators } = props;
  if (!linkedDisplayColumn) return null;
  const { type: displayColumnType, data: displayColumnData, key: displayColumnKey } = linkedDisplayColumn;

  return (
    <div className={classnames('page-design-link-text-formatter', className)}>
      {rows
        .map(row => getCellValueDisplayString(row, displayColumnType, displayColumnKey, { data: displayColumnData, collaborators }))
        .join(', ')
      }
    </div>
  );
}

LinkTextWidget.propTypes = {
  className: PropTypes.string,
  rows: PropTypes.array.isRequired,
  linkedDisplayColumn: PropTypes.object.isRequired,
  collaborators: PropTypes.array,
};

export default LinkTextWidget;
