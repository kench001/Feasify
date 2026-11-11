// Keep notes saved in the former separate field visible until the next proposal save.
export const getOtherRelevantInformation = (proposal: {
  otherDetails?: string;
  additionalFeasibilityDetails?: string;
}): string => {
  const notes = proposal.otherDetails || "";
  const legacy = proposal.additionalFeasibilityDetails || "";
  if (!legacy.trim() || notes.includes(legacy.trim())) return notes;
  return notes.trim() ? `${notes}\n\n${legacy}` : legacy;
};
