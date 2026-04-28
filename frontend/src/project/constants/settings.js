export const PROJECT_DEFAULT_SETTINGS = {
  streaming_response: true,
  agent: {
    enabled: true,
    model: 'gemini-3-flash',
    notify_before_due_hours: 48,
    github_issue_type_mapping: {
      Bug: 'Bug',
      Feature: 'Feature',
    },
  },
};
