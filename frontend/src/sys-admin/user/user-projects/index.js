import React, { useState, useEffect } from 'react';
import { TopBar, Main } from '@/sys-admin/main-panel';
import sysAdminAPI from '@/sys-admin/api';
import { CenteredLoading, CenteredError, ProjectsTable } from '@/components';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import Nav from '../user-nav';
import UserTitle from '../user-title';

const UserProjects = ({ email, onCloseSidePanel }) => {
  const [user, setUser] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [errMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const validEmail = decodeURIComponent(email);
    sysAdminAPI.sysAdminGetUser(validEmail).then((res) => {
      setUser(res.data);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
    }).finally(() => {
      setLoading(false);
    });
  }, [email]);

  const validEmail = decodeURIComponent(email);

  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel} />
      <Main title={<UserTitle username={user.name} />} >
        <Nav currentItem="projects" email={email} />
        {isLoading && (<CenteredLoading />)}
        {errMessage && (<CenteredError>{errMessage}</CenteredError>)}
        {!isLoading && !errMessage && (
          <ProjectsTable
            columns={[
              { name: '', key: 'icon', width: 44, isFixed: true },
              { name: gettext('Name'), key: 'name', width: 0.18 },
              { name: 'ID', key: 'uuid', width: 0.32 },
              { name: 'Owner', key: 'owner', width: 0.25 },
              { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
              { name: '', key: 'placeholder', width: 0.1 },
            ]}
            api={() => sysAdminAPI.sysAdminListUserProjects(validEmail)}
            showPaginator={false}
          />
        )}
      </Main>
    </>
  );
};

export default UserProjects;
