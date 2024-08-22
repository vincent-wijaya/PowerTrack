type DataItem = {
  id: number;
  priority: boolean;
  address: string;
};

// Mock function to fetch headers and data
async function fetchHeadersAndData(): Promise<{
  headers: string[];
  data: DataItem[];
}> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        headers: ['id', 'priority', 'address'],
        data: [
          { id: 1, priority: true, address: '54, Dawes Road' },
          { id: 2, priority: false, address: 'Review document B' },
          { id: 3, priority: true, address: 'Attend meeting C' },
        ],
      });
    }, 1000); // Simulating network delay
  });
}
