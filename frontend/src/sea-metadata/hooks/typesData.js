/* eslint-disable react/prop-types */
import React, { useContext } from 'react';

const TypesDataContext = React.createContext(null);

export const TypesDataProvider = ({
  typesData,
  createType,
  toggleAllTypes,
  children,
}) => {
  return (
    <TypesDataContext.Provider
      value={{
        typesData,
        createType,
        toggleAllTypes,
      }}
    >
      {children}
    </TypesDataContext.Provider>
  );
};

export const useTypesData = () => {
  const context = useContext(TypesDataContext);
  if (!context) {
    throw new Error('\'TypesDataContext\' is null');
  }
  return context;
};
