export default async function fetchSuburbs() {
  const dummyData = {
    suburbs: [
      {
        id: 1,
        name: 'Dandenong',
        postcode: 3011,
        lat: 41.403,
        long: 41.4,
      },
      {
        id: 2,
        name: 'Dandenong',
        postcode: 3011,
        lat: 41.403,
        long: 41.4,
      },
      {
        id: 3,
        name: 'Dandenong',
        postcode: 3011,
        lat: 41.403,
        long: 41.4,
      },
      {
        id: 4,
        name: 'Dandenong',
        postcode: 3011,
        lat: 41.403,
        long: 41.4,
      },
    ],
  };
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
  return dummyData;
}
