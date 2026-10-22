// The one query-string builder for the statistics reads (player, team, and their Dashboards): only a filter that is set is sent, none is
// career / all time. Keys are sent under their own names.
export function statsFilterParams(filters: Readonly<Record<string, string | null | undefined>>): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value
  }
  return params
}
