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

const removeSelf = (addresses, self) => {
  if (!self) return addresses;
  return addresses.filter(address => getEmailAddress(address) !== self);
};

// Build the initial To/Cc lists for Reply and Reply to all (Fastmail semantics).
export const getReplyTargets = (detail, senderEmail) => {
  const self = getEmailAddress(senderEmail);
  const isSender = Boolean(detail?.is_sender);

  const toList = removeSelf(extractEmailAddresses(detail?.email_to || ''), self);
  const ccList = removeSelf(extractEmailAddresses(detail?.cc || ''), self);
  const seen = new Set();

  if (isSender) {
    let replyTo = dedupeAddresses(toList, seen);
    if (replyTo.length === 0) {
      replyTo = dedupeAddresses(ccList, seen);
    }
    const replyAllCc = dedupeAddresses(ccList, seen);
    return {
      replyTo,
      replyAllTo: replyTo,
      replyAllCc,
      hasReplyAll: replyAllCc.length > 0 || toList.length > 1,
    };
  }

  let fromList = extractEmailAddresses(detail?.email_from || '');
  if (fromList.length === 0 && detail?.email_from) {
    fromList = [detail.email_from];
  }
  let replyTo = dedupeAddresses(removeSelf(fromList, self), seen);
  if (replyTo.length === 0) {
    replyTo = dedupeAddresses(toList, seen);
  }
  const replyAllSeen = new Set();
  const replyAllTo = dedupeAddresses([...replyTo, ...toList], replyAllSeen);
  const replyAllCc = dedupeAddresses(ccList, replyAllSeen);

  return {
    replyTo,
    replyAllTo,
    replyAllCc,
    hasReplyAll: replyAllCc.length > 0 || replyAllTo.length > replyTo.length,
  };
};
