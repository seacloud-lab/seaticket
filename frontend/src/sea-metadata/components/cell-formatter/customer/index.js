import React, { useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { DELETED_OPTION_TIPS } from '@/sea-metadata/constants';
import { useCustomersData } from '@/sea-metadata/hooks';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const CustomerFormatter = ({ value, className, children: emptyFormatter }) => {
  const { customersData } = useCustomersData();

  const customer = useMemo(() => {
    return getRowById(customersData, value);
  }, [customersData, value]);

  if (!value) return emptyFormatter || null;

  // the customer may have been deleted since the ticket was created; keep the
  // cell readable rather than rendering an empty cell
  const name = customer?.name || DELETED_OPTION_TIPS;

  // Marked up like a linked record so a customer reads as the same kind of chip.
  // It is not interactive, so unlike `.link-item` it keeps the default cursor.
  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container link-formatter customer-formatter', className)} title={name}>
      <div className="link-item customer-item">
        <span className="link-item-name" title={name}>{name}</span>
      </div>
    </div>
  );
};

CustomerFormatter.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  children: PropTypes.any,
};

export default CustomerFormatter;
