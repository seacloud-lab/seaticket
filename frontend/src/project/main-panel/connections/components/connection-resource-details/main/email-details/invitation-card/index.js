import React, { useMemo, useState } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { gettext } from '@/constants';
import { toaster } from '@/components';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';

import './index.css';

const formatDate = (value, params = {}) => {
  if (!value) return '';
  if (params.VALUE === 'DATE' && /^\d{8}$/.test(value)) {
    const parsed = dayjs(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
    return parsed.isValid() ? parsed.format('ll') : value;
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return value;
  const [, year, month, date, hour, minute, second, utc] = match;
  const parsed = dayjs(`${year}-${month}-${date}T${hour}:${minute}:${second}${utc}`);
  return parsed.isValid() ? parsed.format('ll LT') : value;
};

const parseCalendar = (value) => {
  const fields = {};
  const attendees = [];
  let inEvent = false;
  let nestedComponentDepth = 0;
  const lines = value.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  lines.forEach(line => {
    const upperLine = line.toUpperCase();
    if (upperLine === 'BEGIN:VEVENT') { inEvent = true; return; }
    if (upperLine === 'END:VEVENT') { inEvent = false; return; }
    if (!inEvent) return;
    if (upperLine.startsWith('BEGIN:')) { nestedComponentDepth += 1; return; }
    if (upperLine.startsWith('END:')) { nestedComponentDepth = Math.max(0, nestedComponentDepth - 1); return; }
    if (nestedComponentDepth > 0) return;
    const separator = line.indexOf(':');
    if (separator < 0) return;
    const [name, rawValue] = [line.slice(0, separator), line.slice(separator + 1)];
    const parts = name.split(';');
    const key = parts[0].toUpperCase();
    const params = {};
    parts.slice(1).forEach(param => {
      const index = param.indexOf('=');
      if (index > 0) params[param.slice(0, index).toUpperCase()] = param.slice(index + 1).replace(/^"|"$/g, '');
    });
    const parsedValue = rawValue.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    if (key === 'ATTENDEE') attendees.push({ email: parsedValue.replace(/^mailto:/i, ''), params });
    else if (['SUMMARY', 'DESCRIPTION', 'LOCATION', 'ORGANIZER', 'DTSTART', 'DTEND'].includes(key) && fields[key.toLowerCase()] === undefined) {
      fields[key.toLowerCase()] = parsedValue;
      fields[`${key.toLowerCase()}_params`] = params;
    }
  });
  fields.attendees = attendees;
  return fields;
};

const InvitationCard = ({ detail, projectUuid, connectionId, isReadonly }) => {
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const data = useMemo(() => parseCalendar(detail.calendar_content || ''), [detail.calendar_content]);
  const organizer = (data.organizer || '').replace(/^mailto:/i, '');
  const recipients = (detail.email_to || '').split(',').map(item => item.trim().match(/<([^>]+)>/)?.[1] || item).filter(Boolean);
  const currentAttendee = data.attendees?.find(item => recipients.some(email => email.toLowerCase() === item.email?.toLowerCase())) || (data.attendees?.length === 1 ? data.attendees[0] : null);
  const currentStatus = status || currentAttendee?.params?.PARTSTAT || 'NEEDS-ACTION';
  const statusLabels = {
    ACCEPTED: gettext('Accepted'),
    TENTATIVE: gettext('Maybe'),
    DECLINED: gettext('Declined'),
    'NEEDS-ACTION': gettext('Needs action'),
  };
  const displayStatus = statusLabels[currentStatus] || currentStatus;

  const reply = (partstat) => {
    setIsSubmitting(true);
    connectionsAPI.replyConnectionCalendar(projectUuid, connectionId, { email_id: detail._pk, partstat }).then(() => {
      setStatus(partstat);
    }).catch(error => toaster.danger(Utils.getErrorMsg(error))).finally(() => setIsSubmitting(false));
  };

  return (
    <div className="seaqa-invitation-card">
      <div className="seaqa-invitation-card-title">{data.summary || detail.title || gettext('Meeting invitation')}</div>
      <div className="seaqa-invitation-card-section">
        <div className="seaqa-invitation-card-label">{gettext('When')}</div>
        <div>{formatDate(data.dtstart, data.dtstart_params)}{data.dtend ? ` - ${formatDate(data.dtend, data.dtend_params)}` : ''}</div>
      </div>
      <div className="seaqa-invitation-card-section">
        <div className="seaqa-invitation-card-label">{gettext('Where')}</div>
        <div>{data.location || gettext('No location')}</div>
      </div>
      <div className="seaqa-invitation-card-section">
        <div className="seaqa-invitation-card-label">{gettext('Who')}</div>
        <div>{organizer && <div>{gettext('Organizer')}: {organizer}</div>}{data.attendees?.map(item => item.email).join(', ') || gettext('No attendees')}</div>
      </div>
      <div className="seaqa-invitation-card-actions">
        <div className="seaqa-invitation-card-label">{gettext('RSVP')}</div>
        <span className={`seaqa-invitation-card-status ${currentStatus.toLowerCase()}`}>{displayStatus}</span>
        {!isReadonly && (
          <>
            <Button size="sm" color="primary" disabled={isSubmitting} onClick={() => reply('ACCEPTED')}>{gettext('Accept')}</Button>
            <Button size="sm" color="secondary" disabled={isSubmitting} onClick={() => reply('TENTATIVE')}>{gettext('Maybe')}</Button>
            <Button size="sm" color="link" disabled={isSubmitting} onClick={() => reply('DECLINED')}>{gettext('Decline')}</Button>
          </>
        )}
      </div>
      <div className="seaqa-invitation-card-section">
        <div className="seaqa-invitation-card-label">{gettext('Notes')}</div>
        <div className="seaqa-invitation-card-note">{data.description || gettext('No notes')}</div>
      </div>
    </div>
  );
};

export default InvitationCard;
