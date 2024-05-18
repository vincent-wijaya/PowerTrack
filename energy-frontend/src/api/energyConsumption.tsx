export default async function fetchEnergyConsumption() {
    const dummyData = {
        energy: [
            {
              suburb_id: 21513,
              amount: 123.45,
              date: "2024-04-17T09:06:41Z",
            },
           
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
    return dummyData

}