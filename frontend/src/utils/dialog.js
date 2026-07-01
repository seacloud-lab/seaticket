import { DIALOG_SIZE, DIALOG_SIZE_VALUE } from '@/constants';

export const getDialogSize = (innerWidth) => {
  if (innerWidth >= DIALOG_SIZE_VALUE[DIALOG_SIZE.L]) return DIALOG_SIZE.L;
  if (innerWidth >= DIALOG_SIZE_VALUE[DIALOG_SIZE.M]) return DIALOG_SIZE.M;
  if (innerWidth > DIALOG_SIZE_VALUE[DIALOG_SIZE.S]) return DIALOG_SIZE.S;
  return DIALOG_SIZE.XS;
};

export const isSmallContainer = (containerWidth) => {
  return containerWidth < DIALOG_SIZE_VALUE[DIALOG_SIZE.S];
};
