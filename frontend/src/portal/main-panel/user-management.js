import React, { useState, useEffect, useCallback } from 'react';
import { Nav, NavItem, NavLink, Button, Input, Label, FormGroup } from 'reactstrap';
import { EmptyTip, toaster, IconButton } from '@/components';
import dayjs from '@/utils/dayjs';
import { gettext } from '@/constants';
import { portalAPI } from '../api';

const Tabs = { USERS: 'users', INVITE_LINKS: 'invite_links' };

const UserManagement = ({ projectUuid }) => {
  const [activeTab, setActiveTab] = useState(Tabs.USERS);
  const [email, setEmail] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [list, setList] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');

  const loadInvites = useCallback(() => {
    portalAPI.listExternalInvitations(projectUuid).then(res => {
      const items = (res.data && res.data.invite_list) || [];
      setList(items);
    });
  }, [projectUuid]);

  const loadUsers = useCallback(() => {
    portalAPI.listExternalUsers(projectUuid).then(res => {
      const items = (res.data && res.data.users) || [];
      setUsers(items);
    });
  }, [projectUuid]);

  useEffect(() => { loadUsers(); loadInvites(); }, [loadUsers, loadInvites]);

  const createLink = useCallback(() => {
    if (!email) return;
    setSubmitting(true);
    portalAPI.createExternalInvitation(projectUuid, email).then(() => {
      toaster.success(gettext('Link generated'));
      setEmail('');
      loadInvites();
      loadUsers();
    }).catch((error) => {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.error_msg;
      const errorMessage = (status === 503 && serverMsg) ? serverMsg : gettext('Failed to generate invitation link');
      toaster.danger(errorMessage);
    }).finally(() => setSubmitting(false));
  }, [email, projectUuid, loadInvites, loadUsers]);

  const shorten = useCallback((text) => {
    if (!text) return '';
    const max = 28;
    if (text.length <= max) return text;
    return `${text.slice(0, 8)}...${text.slice(-14)}`;
  }, []);

  const onCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      toaster.success(gettext('Copied'), { duration: 2, hasCloseButton: false });
    });
  }, []);

  return (
    <>
      <div className="portal-settings-dialog-side dialog-side-nav">
        <Nav pills vertical className="w-100">
          <NavItem>
            <NavLink className={activeTab === Tabs.USERS ? 'active' : ''} onClick={() => setActiveTab(Tabs.USERS)}>
              {gettext('Users')}
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink className={activeTab === Tabs.INVITE_LINKS ? 'active' : ''} onClick={() => setActiveTab(Tabs.INVITE_LINKS)}>
              {gettext('Invitation links')}
            </NavLink>
          </NavItem>
        </Nav>
      </div>
      <div className="portal-settings-dialog-main">
        {activeTab === Tabs.USERS && (
          <div className="p-3 w-100">
            <div className="mb-3">
              <Input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={gettext('Search users')} />
            </div>
            {users.length > 0 &&
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>{gettext('User')}</th>
                  <th className="text-center" style={{ width: 160 }}>{gettext('Status')}</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(u => !query || (u.name || '').toLowerCase().includes(query.toLowerCase()) || (u.email || '').toLowerCase().includes(query.toLowerCase()))
                  .map(u => (
                    <tr key={u.username}>
                      <td className="align-middle">
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span className="text-truncate" title={u.name || u.email}>{u.name || u.email}</span>
                        </div>
                      </td>
                      <td className="text-center align-middle">{u.activated ? gettext('Activated') : gettext('Inactive')}</td>
                      <td className="text-right operation-btns align-middle">
                        <IconButton icon="close" onClick={() => portalAPI.deleteExternalUser(projectUuid, u.email).then(() => loadUsers()).catch(() => toaster.danger(gettext('Delete failed')))} title={gettext('Delete')} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            }
            {users.length === 0 &&
            <div className="h-100">
              <EmptyTip text={gettext('No users')} />
            </div>
            }
          </div>
        )}
        {activeTab === Tabs.INVITE_LINKS && (
          <div className="p-3 w-100">
            <div className="mb-3">
              <Label for="email" className="mr-2">{gettext('Email')}</Label>
              <FormGroup className="d-flex">
                <Input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={gettext('Enter email')}
                  className="mr-2"
                  style={{ maxWidth: 'calc(100% - 100px)' }}
                />
                <Button color="primary" disabled={isSubmitting || !email} onClick={createLink} className={isSubmitting ? 'btn-loading' : ''}>
                  {gettext('Generate')}
                </Button>
              </FormGroup>
            </div>
            {list.length > 0 &&
            <div className="mt-3">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: 200 }}>{gettext('Email')}</th>
                    <th>{gettext('Invitation link')}</th>
                    <th style={{ width: 220 }}>{gettext('Expiration time')}</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(item => (
                    <tr key={item.token}>
                      <td className="align-middle">
                        <span className="text-truncate d-inline-block" title={item.email} style={{ maxWidth: 200 }}>
                          {item.email}
                        </span>
                      </td>
                      <td className="text-truncate align-middle" title={item.link}>{shorten(item.link)}</td>
                      <td className="align-middle" style={{ whiteSpace: 'nowrap' }}>{item.expire_time ? dayjs(item.expire_time).format('YYYY-MM-DD HH:mm') : '-'}</td>
                      <td className="text-right operation-btns align-middle">
                        <div className="d-inline-flex align-items-center" style={{ gap: 8 }}>
                          <IconButton icon="copy" onClick={() => onCopy(item.link)} title={gettext('Copy')} />
                          <IconButton icon="close" onClick={() => portalAPI.revokeExternalInvitation(projectUuid, item.token).then(() => loadInvites())} title={gettext('Delete')} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            }
            {list.length === 0 &&
            <div className="h-100">
              <EmptyTip text={gettext('No invitation links')} />
            </div>
            }
          </div>
        )}
      </div>
    </>
  );
};

export default UserManagement;
