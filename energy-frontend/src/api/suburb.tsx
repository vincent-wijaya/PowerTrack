export default async function fetchEnergyConsumption() {
    const dummyData = {
        energy: [
            {
              suburb_id: 22158,
              amount: 0,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 22303,
              amount: 500,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 21143,
              amount: 1000,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20416,
              amount: 100,
              date: "2024-04-17T09:06:41Z",
            },
            {
              suburb_id: 20451,
              amount: 200,
              date: "2024-04-17T09:06:41Z",
            },
           
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
    return dummyData
}