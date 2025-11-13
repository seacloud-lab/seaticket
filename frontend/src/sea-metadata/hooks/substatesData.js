/* eslint-disable react/prop-types */
import React, { useContext } from 'react';

const SubstatesDataContext = React.createContext(null);

export const SubstatesDataProvider = ({
  substatesData,
  createSubstate,
  toggleAllSubstates,
  children,
}) => {
  return (
    <SubstatesDataContext.Provider
      value={{
        substatesData,
        createSubstate,
        toggleAllSubstates,
      }}
    >
      {children}
    </SubstatesDataContext.Provider>
  );
};

export const useSubstatesData = () => {
  const context = useContext(SubstatesDataContext);
  if (!context) {
    throw new Error('\'SubstatesDataContext\' is null');
  }
  return context;
};
