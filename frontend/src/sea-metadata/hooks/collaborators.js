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
  const [collaborators, setCollaborators] = useState(propsCollaborators);
  const queryUser = useMemo(() => {
    const userService = new UserService({ mediaUrl, api: listUserInfo });
    return userService.queryUser;
  }, [listUserInfo]);

  const updateCollaboratorsCache = useCallback((user) => {
    const newCollaboratorsCache = { ...collaboratorsCache, [user.email]: user };
    setCollaboratorsCache(newCollaboratorsCache);
    propsUpdateCollaboratorsCache && propsUpdateCollaboratorsCache(user);
  }, [collaboratorsCache, propsUpdateCollaboratorsCache]);

  useEffect(() => {
    getCollaborators().then(res => {
      const collaborators = Array.isArray(res?.data?.user_list) ? res.data.user_list.map(user => new User(user)) : [];
      setCollaborators(collaborators);
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
    <CollaboratorsContext.Provider value={{ collaborators, collaboratorsCache, updateCollaboratorsCache, getCollaborator, queryUser }}>
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
