import React, { useState, useEffect, useCallback } from 'react';
import { Nav, NavItem, NavLink, Button, Input, Label } from 'reactstrap';
import { Icon, toaster } from '@/components';
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
    }).catch(() => {
      toaster.danger(gettext('Generate failed'));
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
          <div className="p-3">
            <div className="mb-3 d-flex" style={{ gap: 8 }}>
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={gettext('Search users')} />
            </div>
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
                      <td>
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span className="text-truncate" title={u.name || u.email}>{u.name || u.email}</span>
                        </div>
                      </td>
                      <td className="text-center">{u.activated ? gettext('Activated') : gettext('Inactive')}</td>
                      <td className="text-right">
                        <button className="btn btn-link p-0" onClick={() => portalAPI.deleteExternalUser(projectUuid, u.email).then(() => loadUsers()).catch(() => toaster.danger(gettext('Delete failed')))} title={gettext('Delete')}>
                          <Icon symbol="delete" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === Tabs.INVITE_LINKS && (
          <div className="p-3">
            <div className="mb-3">
              <Label className="mr-2">{gettext('Email')}</Label>
              <div className="d-flex" style={{ gap: 8 }}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={gettext('Enter email')} />
                <Button color="primary" disabled={isSubmitting || !email} onClick={createLink} className={isSubmitting ? 'btn-loading' : ''}>
                  {gettext('Generate link')}
                </Button>
              </div>
            </div>
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
                      <td>
                        <span className="text-truncate" title={item.email} style={{ maxWidth: 200, display: 'inline-block' }}>
                          {item.email}
                        </span>
                      </td>
                      <td className="text-truncate" title={item.link}>{shorten(item.link)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{item.expire_time ? dayjs(item.expire_time).format('YYYY-MM-DD HH:mm') : '-'}</td>
                      <td className="text-right">
                        <div className="d-inline-flex" style={{ gap: 8 }}>
                          <button className="btn btn-link p-0" onClick={() => onCopy(item.link)} title={gettext('Copy')}>
                            <Icon symbol="copy" />
                          </button>
                          <button className="btn btn-link p-0" onClick={() => portalAPI.revokeExternalInvitation(projectUuid, item.token).then(() => loadInvites())} title={gettext('Disable')}>
                            <Icon symbol="revoke" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UserManagement;
