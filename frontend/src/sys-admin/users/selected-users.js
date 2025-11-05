import React, { useCallback, useContext, useState } from 'react';

const SelectedUsersContext = React.createContext(null);

export const SelectedUsersProvider = ({ children }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);

  const toggleUser = useCallback((email) => {
    let newValue = selectedUsers.slice(0);
    const emailIndex = newValue.findIndex(v => v === email);
    if (emailIndex > -1) {
      newValue.splice(emailIndex, 1);
    } else {
      newValue.push(email);
    }
    setSelectedUsers(newValue);
  }, [selectedUsers]);

  return (
    <SelectedUsersContext.Provider value={{
      selectedUsers,
      updateSelectedUsers: setSelectedUsers,
      toggleUser,
    }}>
      {children}
    </SelectedUsersContext.Provider>
  );
};

export const useSelectedUsers = () => {
  const context = useContext(SelectedUsersContext);
  if (!context) {
    throw new Error('\'SelectedUsersContext\' is null');
  }
  return context;
};
