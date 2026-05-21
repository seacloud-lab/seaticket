/* eslint-disable react/prop-types */
import React, { useContext, useState, useCallback, useEffect, useMemo } from 'react';
import UserService from '../utils/user-service';
import { mediaUrl } from '@/constants';
import { isValidEmail } from '@/utils/validate';
import User from '@/models/user';

const CollaboratorsContext = React.createContext(null);

export const CollaboratorsProvider = ({
  collaborators: propsCollaborators = [],
  collaboratorsCache: propsCollaboratorsCache = {},
  updateCollaboratorsCache: propsUpdateCollaboratorsCache,
  listUserInfo,
  getCollaborators,
  children
}) => {
  const [collaboratorsCache, setCollaboratorsCache] = useState(propsCollaboratorsCache);
  const [baseCollaborators, setBaseCollaborators] = useState(propsCollaborators);
  const [scopedCollaboratorsMap, setScopedCollaboratorsMap] = useState({});
  const collaborators = useMemo(() => {
    const emailUserMap = {};
    baseCollaborators.forEach((user) => {
      if (user?.email) {
        emailUserMap[user.email] = user;
      }
    });
    Object.values(scopedCollaboratorsMap).forEach((users) => {
      if (!Array.isArray(users)) return;
      users.forEach((user) => {
        if (user?.email) {
          emailUserMap[user.email] = user;
        }
      });
    });
    return Object.values(emailUserMap);
  }, [baseCollaborators, scopedCollaboratorsMap]);
  const queryUser = useMemo(() => {
    const userService = new UserService({ mediaUrl, api: listUserInfo });
    return userService.queryUser;
  }, [listUserInfo]);

  const updateCollaboratorsCache = useCallback((user) => {
    const newCollaboratorsCache = { ...collaboratorsCache, [user.email]: user };
    setCollaboratorsCache(newCollaboratorsCache);
    propsUpdateCollaboratorsCache && propsUpdateCollaboratorsCache(user);
  }, [collaboratorsCache, propsUpdateCollaboratorsCache]);

  const setScopedCollaborators = useCallback((scopeKey, users) => {
    if (!scopeKey) return;
    const validUsers = Array.isArray(users) ? users.filter(user => user?.email) : [];
    setScopedCollaboratorsMap((prevScopedCollaboratorsMap) => {
      return {
        ...prevScopedCollaboratorsMap,
        [scopeKey]: validUsers,
      };
    });
    if (validUsers.length > 0) {
      setCollaboratorsCache((prevCollaboratorsCache) => {
        const nextCollaboratorsCache = { ...prevCollaboratorsCache };
        validUsers.forEach((user) => {
          nextCollaboratorsCache[user.email] = user;
          propsUpdateCollaboratorsCache && propsUpdateCollaboratorsCache(user);
        });
        return nextCollaboratorsCache;
      });
    }
  }, [propsUpdateCollaboratorsCache]);

  const clearScopedCollaborators = useCallback((scopeKey) => {
    if (!scopeKey) return;
    setScopedCollaboratorsMap((prevScopedCollaboratorsMap) => {
      if (!prevScopedCollaboratorsMap[scopeKey]) return prevScopedCollaboratorsMap;
      const nextScopedCollaboratorsMap = { ...prevScopedCollaboratorsMap };
      delete nextScopedCollaboratorsMap[scopeKey];
      return nextScopedCollaboratorsMap;
    });
  }, []);

  useEffect(() => {
    if (!getCollaborators) return;
    getCollaborators().then(res => {
      const collaborators = Array.isArray(res?.data?.user_list) ? res.data.user_list.map(user => new User(user)) : [];
      setBaseCollaborators(collaborators);
    });
  }, [getCollaborators]);

  const getCollaborator = useCallback((email) => {
    let collaborator = collaborators && collaborators.find(c => c.email === email);
    if (collaborator) return collaborator;

    const defaultAvatarUrl = `${mediaUrl}/avatars/default.png`;
    if (email === 'anonymous') {
      return {
        name: 'anonymous',
        avatar_url: defaultAvatarUrl,
      };
    }

    collaborator = collaboratorsCache[email];
    if (collaborator) return collaborator;

    if (!isValidEmail(email)) {
      collaborator = {
        email: email,
        name: email,
        avatar_url: defaultAvatarUrl,
      };
      updateCollaboratorsCache(collaborator);
      return collaborator;
    }
    return null;
  }, [collaborators, collaboratorsCache, updateCollaboratorsCache]);

  return (
    <CollaboratorsContext.Provider value={{
      collaborators,
      collaboratorsCache,
      updateCollaboratorsCache,
      setScopedCollaborators,
      clearScopedCollaborators,
      getCollaborator,
      queryUser,
    }}>
      {children}
    </CollaboratorsContext.Provider>
  );
};

export const useCollaborators = () => {
  const context = useContext(CollaboratorsContext);
  if (!context) {
    throw new Error('\'CollaboratorsContext\' is null');
  }
  return context;
};
