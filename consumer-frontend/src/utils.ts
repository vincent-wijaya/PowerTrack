export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `An error occurred while fetching the data. Data: ${await res.json()} Status Code: ${
        res.status
      }`
    );
  }

  return res.json();
};
