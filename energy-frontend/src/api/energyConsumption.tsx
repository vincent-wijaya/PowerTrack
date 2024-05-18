export default async function fetchEnergyConsumption() {
    const dummyData = {
        energy: [
            {
              suburb_id: 20457,
              amount: 0,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20456,
              amount: 10,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20455,
              amount: 50,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20454,
              amount: 100,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20453,
              amount: 200,
              date: "2024-04-17T09:06:41Z",
            },
           
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
    return dummyData
}