import { randBetween } from "@/utils";

export default async function fetchGoals(id: number) {
    const dummyData = {
        energy: [
            {
              id: 20457,
              category: 'green energy',
              target: 0.8,
              progress: 0.7
            },
            {
              suburb_id: 20456,
              category: 'green energy',
              target: 0.8,
              progress: 0.7
            },
            {
              suburb_id: 20455,
              category: 'green energy',
              target: 0.8,
              progress: 0.7
            },
            {
              suburb_id: 20454,
              category: 'green energy',
              target: 0.8,
              progress: 0.7
            },
            {
              suburb_id: 20453,
              category: 'green energy',
              target: 0.8,
              progress: 0.7
            },
          ],
    }
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 seconds

    // filter the goal by id & return
    const goal = dummyData.energy.find((item) => item.suburb_id === id);
    if (goal) {
        return goal;
    } else {
        throw new Error(`Goal with ID ${id} not found`);
    }
}