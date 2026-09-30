/* eslint-disable react/prop-types */
import React, { useContext } from 'react';

const CustomersDataContext = React.createContext(null);

export const CustomersDataProvider = ({
  customersData,
  children,
}) => {
  return (
    <CustomersDataContext.Provider
      value={{
        customersData,
      }}
    >
      {children}
    </CustomersDataContext.Provider>
  );
};

export const useCustomersData = () => {
  const context = useContext(CustomersDataContext);
  if (!context) {
    throw new Error('\'CustomersDataContext\' is null');
  }
  return context;
};
