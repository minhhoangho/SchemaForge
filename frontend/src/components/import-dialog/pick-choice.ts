/** Narrows a string from a UI control to one of the known choices. */
export function pickChoice<Choice extends string>(
  choices: readonly Choice[],
  value: string,
): Choice | undefined {
  return choices.find((choice) => choice === value);
}
