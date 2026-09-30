import React, { useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { useCustomersData } from '@/sea-metadata/hooks';
import { getRowById, isEmptyCustomerId } from '@/sea-metadata/utils/row';

import './index.css';

const CustomerFormatter = ({ value, className, children: emptyFormatter }) => {
  const { customersData } = useCustomersData();

  const customer = useMemo(() => {
    return getRowById(customersData, value);
  }, [customersData, value]);

  // The value is empty (the literal 'null' also counts -- see isEmptyCustomerId),
  // or it points at a customer that no longer exists: deleting a customer does not
  // rewrite the tickets referencing it, so the id can dangle. Like the tags and
  // linked-records cells, an unresolvable reference is hidden rather than shown as
  // a placeholder -- the cell reads as "no customer". (Grouping still surfaces it,
  // see group-title.js.)
  if (isEmptyCustomerId(value) || !customer) return emptyFormatter || null;

  const name = customer.name;

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
