import { randBetween } from "@/utils";

export default async function fetchEnergyConsumption() {
    const dummyData = {
        energy: [
            {
              suburb_id: 20457,
              amount: 0,
              date: new Date().toISOString(),
            },
            {
              suburb_id: 20456,
              amount: randBetween(10, 1000),
              date: new Date().toISOString(),
            },
            {
              suburb_id: 20455,
              amount: randBetween(10, 1000),
              date:  new Date().toISOString(),
            },
            {
              suburb_id: 20454,
              amount: randBetween(10, 1000),
              date: new Date().toISOString(),
            },
            {
              suburb_id: 20453,
              amount: randBetween(10, 1000),
              date: new Date().toISOString(),
            },
           
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 second
    return dummyData
}