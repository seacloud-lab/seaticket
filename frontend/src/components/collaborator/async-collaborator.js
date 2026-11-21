import React, { useEffect, useState } from 'react';
import { mediaUrl as appMediaUrl } from '@/constants';
import { parseEmailAddress } from '@/utils/email';
import { isValidEmail } from '@/utils/validate';
import Collaborator from './collaborator';

const getDefaultAvatarUrl = (mediaUrl) => {
  const normalizedMediaUrl = (mediaUrl || appMediaUrl || '').replace(/\/$/, '');
  return `${normalizedMediaUrl}/avatars/default.png`;
};

const AsyncCollaborator = ({ className, value, isEmailUser = false, mediaUrl = appMediaUrl, api, collaborators, collaboratorsCache, updateCollaboratorsCache, children }) => {
  const [collaborator, setCollaborator] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      isMounted && setCollaborator(null);
      return () => isMounted = false;
    }
    if (isEmailUser) {
      const { name, email, fullName } = parseEmailAddress(value);
      isMounted && setCollaborator({ name, email, fullName });
      return () => isMounted = false;
    }
    let collaborator = collaborators && collaborators.find(c => c.email === value);
    if (collaborator) {
      isMounted && setCollaborator(collaborator);
      return () => isMounted = false;
    }

    const defaultAvatarUrl = getDefaultAvatarUrl(mediaUrl);
    if (value === 'anonymous') {
      collaborator = {
        name: 'anonymous',
        avatar_url: defaultAvatarUrl,
      };
      isMounted && setCollaborator(collaborator);
      return () => isMounted = false;
    }

    collaborator = collaboratorsCache[value];
    if (collaborator) {
      isMounted && setCollaborator(collaborator);
      return () => isMounted = false;
    }

    if (!isValidEmail(value)) {
      collaborator = {
        email: value,
        name: value,
        avatar_url: defaultAvatarUrl,
      };
      updateCollaboratorsCache(collaborator);
      isMounted && setCollaborator(collaborator);
      return () => isMounted = false;
    }

    api && api(value, (userMap) => {
      collaborator = userMap[value];
      updateCollaboratorsCache(collaborator);
      isMounted && setCollaborator(collaborator);
    });
    return () => isMounted = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!collaborator) return null;

  return (
    <Collaborator collaborator={collaborator} className={className}>
      {children}
    </Collaborator>
  );
};

export default AsyncCollaborator;
