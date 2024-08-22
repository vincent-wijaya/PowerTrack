import Link from 'next/link';

export default function LoginPage() {
  return (
    <>
      <div className="bg-background">
        <div className="flex justify-center py-24">
          <div className="text-white space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                ORGANISATION ID
              </label>
              <input
                className="bg-gray-50 border border-gray-300 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-black dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="john.doe@company.com"
                required
              />
            </div>
            <div className="bg-purple text-center rounded-lg p-2">
              <Link href={'/main/mainDashboard'}>Login</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
