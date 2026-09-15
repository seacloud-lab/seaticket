import React from 'react';
import { Button, Input } from 'reactstrap';
import { CustomizeSelect, EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import dayjs from '@/utils/dayjs';
import OperationButton from './operation-button';

import './invite-users-page.css';

const shortenInvitationLink = (link) => {
  if (!link || link.length <= 17) return link || '';
  return `${link.slice(0, 9)}...${link.slice(-5)}`;
};

const InviteCustomerSelect = ({ selectedCustomerId, customers, onChange, isInModal }) => {
  const options = [
    { value: '', label: '--' },
    ...customers.map(customer => ({ value: String(customer.id), label: customer.name })),
  ];
  const selectedValue = String(selectedCustomerId ?? '');
  const validOptions = selectedValue === '' ? options.filter(option => option.value !== '') : options;

  return (
    <CustomizeSelect
      id="portal-invite-customer"
      value={selectedValue}
      options={validOptions}
      onChange={onChange}
      searchable={false}
      isInModal={isInModal}
      noOptionsPlaceholder={gettext('No customers')}
    />
  );
};

const InviteUsersPage = ({
  invitations, email, selectedCustomerId, customers, isSubmitting,
  onEmailChange, onCustomerChange, onInvite, onCopy, onRevoke, isInModal = false,
}) => (
  <div className="portal-invite-users-page">
    <div className="portal-invite-users-form">
      <div className="portal-invite-users-labels">
        <span>{gettext('Invite users')}</span>
        <span className="pl-2">{gettext('Customer')}</span>
      </div>
      <div className="portal-invite-users-controls">
        <label className="portal-invite-users-field" htmlFor="portal-invite-user-email">
          <Input
            id="portal-invite-user-email"
            className="portal-user-management-input"
            name="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder={gettext('Enter email to invite')}
          />
        </label>
        <label className="portal-invite-users-field" htmlFor="portal-invite-customer">
          <InviteCustomerSelect
            selectedCustomerId={selectedCustomerId}
            customers={customers}
            isInModal={isInModal}
            onChange={onCustomerChange}
          />
        </label>
        <Button color="primary" disabled={isSubmitting || !email.trim()} onClick={onInvite} className={isSubmitting ? 'btn-loading' : ''}>
          {gettext('Invite')}
        </Button>
      </div>
    </div>
    {invitations.length > 0 ? (
      <div className="portal-user-management-table-wrapper">
        <table className="table table-sm portal-user-management-table">
          <colgroup>
            <col className="portal-invite-email-column" />
            <col className="portal-invite-link-column" />
            <col className="portal-invite-expiration-column" />
            <col className="portal-user-operations-column" />
          </colgroup>
          <thead>
            <tr>
              <th>{gettext('Email')}</th>
              <th>{gettext('Invitation link')}</th>
              <th>{gettext('Expiration time')}</th>
              <th>{/* More operations */}</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map(item => (
              <tr key={item.token}>
                <td><span className="text-truncate d-block" title={item.email}>{item.email}</span></td>
                <td className="text-truncate" title={item.link}>{shortenInvitationLink(item.link)}</td>
                <td className="portal-invite-expiration-cell">
                  {item.expire_time ? dayjs(item.expire_time).format('YYYY-MM-DD HH:mm') : '-'}
                </td>
                <td className="text-right operation-btns">
                  <div className="portal-customer-operation-btns">
                    <OperationButton icon="copy" tip={gettext('Copy')} onClick={() => onCopy(item.link)} />
                    <OperationButton icon="delete" tip={gettext('Delete')} onClick={() => onRevoke(item.token)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="portal-user-management-empty">
        <EmptyTip text={gettext('No pending invitations')} src={`${mediaUrl}img/no-items-tip.png`} />
      </div>
    )}
  </div>
);

export default InviteUsersPage;
