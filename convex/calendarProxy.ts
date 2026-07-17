type FetchCalendarDataArgs = {
  calendarUrl: string;
  username: string;
  password: string;
  fetcher?: typeof fetch;
};

export async function fetchCalendarData({
  calendarUrl,
  username,
  password,
  fetcher = fetch,
}: FetchCalendarDataArgs): Promise<string> {
  const credentials = btoa(`${username}:${password}`);
  const response = await fetcher(calendarUrl, {
    headers: {
      Accept: "text/calendar",
      Authorization: `Basic ${credentials}`,
      "User-Agent": "Brigade-Management-System/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Calendar server responded with ${response.status}: ${response.statusText}`,
    );
  }

  return await response.text();
}
