import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Collaborator from './collaborator';
import { mediaUrl as appMediaUrl } from '@/constants';
import { isValidEmail } from '@/utils/validate';

const getDefaultAvatarUrl = (mediaUrl) => {
  const normalizedMediaUrl = (mediaUrl || appMediaUrl || '').replace(/\/$/, '');
  return `${normalizedMediaUrl}/avatars/default.png`;
};

const AsyncCollaborator = ({ className, value, mediaUrl = appMediaUrl, api, collaborators, collaboratorsCache, updateCollaboratorsCache, children }) => {
  const [collaborator, setCollaborator] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      isMounted && setCollaborator(null);
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

AsyncCollaborator.propTypes = {
  value: PropTypes.string,
};

export default AsyncCollaborator;
