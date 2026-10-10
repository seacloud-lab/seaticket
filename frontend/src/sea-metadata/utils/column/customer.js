import { getRowById, isEmptyCustomerId } from '../row';

/**
 * Customers are project-scoped records owned by the server, so unlike a
 * single-select column their options come from context data rather than from the
 * column's own `data.options`.
 */
export const getCustomersOptions = (customersData) => {
  if (!customersData) return [];
  const options = Array.isArray(customersData.rows) ? customersData.rows : [];
  return options.map(o => {
    return {
      value: o._id,
      id: o._id,
      name: o.name,
      status: o.status,
    };
  });
};

export const getCustomerDisplayString = (customersData, cellValue = '') => {
  if (!customersData) return '';
  if (isEmptyCustomerId(cellValue)) return '';
  const customer = getRowById(customersData, cellValue);
  return customer?.name || '';
};
