import { extractEmailAddresses, getEmailAddress } from '@/utils/email';

const dedupeAddresses = (addresses, seen) => {
  const result = [];
  addresses.forEach((address) => {
    const key = getEmailAddress(address);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(address);
  });
  return result;
};

export const getReplyTargets = (detail, senderEmail) => {
  const self = getEmailAddress(senderEmail);
  const isSender = Boolean(detail?.is_sender);

  const rawToList = extractEmailAddresses(detail?.email_to || '', { deduplicate: false });
  const rawCcList = extractEmailAddresses(detail?.cc || '');
  let fromList = extractEmailAddresses(detail?.email_from || '');
  if (fromList.length === 0 && detail?.email_from) {
    fromList = [detail.email_from];
  }
  const primaryTo = getEmailAddress(rawToList[0]);
  const from = getEmailAddress(fromList[0]);
  // Fastmail checks the original headers, independently of the eventual reply targets.
  const hasReplyAll = rawCcList.length > 0 || rawToList.length > 1 ||
    Boolean(primaryTo && primaryTo !== from && primaryTo !== self);

  const seen = new Set();

  if (isSender) {
    let replyTo = dedupeAddresses(rawToList, seen);
    if (replyTo.length === 0) {
      replyTo = dedupeAddresses(rawCcList, seen);
    }
    const replyAllCc = dedupeAddresses(rawCcList, seen);
    return {
      replyTo,
      replyAllTo: replyTo,
      replyAllCc,
      hasReplyAll,
    };
  }

  let replyTo = dedupeAddresses(fromList, seen);
  if (replyTo.length === 0) {
    replyTo = dedupeAddresses(rawToList, seen);
  }
  const replyAllSeen = new Set();
  const replyAllTo = dedupeAddresses([...replyTo, ...rawToList], replyAllSeen);
  const replyAllCc = dedupeAddresses(rawCcList, replyAllSeen);

  return {
    replyTo,
    replyAllTo,
    replyAllCc,
    hasReplyAll,
  };
};
