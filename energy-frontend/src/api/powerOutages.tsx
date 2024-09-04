export default async function fetchPowerOutages() {
  const dummyData = {
    suburbs: [
      {
        id: 22158,
        name: 'Richmond',
        households: [{}],
      },
    ],
  };
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
  return dummyData;
}
