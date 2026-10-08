// docs/specs/084: where a poll's Responses page lives - the one place the two routes are spelled out.
// A group poll (round) is addressed by its round id, a squad poll by its match id and poll id.
export const groupPollResponsesPath = (roundId: string) => `/manage/availability/group/${roundId}`

export const squadPollResponsesPath = (matchId: string, pollId: string) =>
  `/manage/availability/squad/${matchId}/${pollId}`
