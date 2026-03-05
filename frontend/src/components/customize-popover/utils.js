export const generatorModifiers = ({ modifiers, sameWidthWithTarget = false }) => {
  if (!sameWidthWithTarget) return modifiers;
  let _modifiers = Array.isArray(modifiers) ? modifiers : [];

  const flipModifier = {
    name: 'flip',
    enabled: true,
    options: {},
  };
  const flipModifierIndex = _modifiers.findIndex(m => m.name === 'flip');
  if (flipModifierIndex === -1) {
    _modifiers.push(flipModifier);
  } else {
    const modifier = _modifiers[flipModifierIndex];
    _modifiers[flipModifierIndex] = { ...flipModifier, ...modifier };
  }

  const computeStylesModifier = {
    name: 'computeStyles',
    enabled: true,
    options: {
      // gpuAcceleration: false,
      adaptive: true,
    },
  };
  const computeStylesModifierIndex = _modifiers.findIndex(m => m.name === 'computeStyles');
  if (computeStylesModifierIndex === -1) {
    _modifiers.push(computeStylesModifier);
  } else {
    const modifier = _modifiers[computeStylesModifierIndex];
    _modifiers[computeStylesModifierIndex] = { ...computeStylesModifier, ...modifier };
  }

  const sameWidthModifier = {
    name: 'sameWidth',
    enabled: true,
    phase: 'beforeWrite',
    requires: ['computeStyles'],
    fn: ({ state }) => {
      if (state.elements.reference) {
        const width = state.elements.reference.getBoundingClientRect().width;
        const validWidth = Math.max(sameWidthWithTarget, width);
        state.styles.popper.width = `${validWidth}px`;
        state.styles.popper.maxWidth = `${validWidth}px`;
      }
    },
  };
  const sameWidthModifierIndex = _modifiers.findIndex(m => m.name === 'sameWidth');
  if (sameWidthModifierIndex === -1) {
    _modifiers.push(sameWidthModifier);
  } else {
    const modifier = _modifiers[sameWidthModifierIndex];
    _modifiers[sameWidthModifierIndex] = { ...sameWidthModifier, ...modifier };
  }

  return _modifiers;
};
