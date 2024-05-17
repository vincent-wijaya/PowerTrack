export default async function fetchEnergyConsumption() {
    const dummyData = {
        energy: [
            {
              suburb_id: 1,
              amount: 123.45,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 2,
              amount: 678.90,
              date: "2024-04-17T10:15:00Z",
            },
            {
              suburb_id: 3,
              amount: 234.56,
              date: "2024-04-18T08:22:30Z",
            },
            {
              suburb_id: 4,
              amount: 789.01,
              date: "2024-04-18T11:45:10Z",
            },
            {
              suburb_id: 5,
              amount: 345.67,
              date: "2024-04-19T14:00:00Z",
            },
            {
              suburb_id: 6,
              amount: 890.12,
              date: "2024-04-19T16:30:25Z",
            },
            {
              suburb_id: 7,
              amount: 456.78,
              date: "2024-04-20T09:50:45Z",
            },
            {
              suburb_id: 8,
              amount: 901.23,
              date: "2024-04-20T12:10:10Z",
            },
            {
              suburb_id: 9,
              amount: 567.89,
              date: "2024-04-21T13:30:55Z",
            },
            {
              suburb_id: 10,
              amount: 112.34,
              date: "2024-04-21T15:45:30Z",
            },
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 1)); // Simulating a delay of 1 second
    return dummyData

}