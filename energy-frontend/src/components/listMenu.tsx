import Link from 'next/link';

interface ListMenuProps {
  icon: React.ReactNode;
  description: string;
  href: string; // The URL of the page to navigate to
}

export default function ListMenu({ icon, description, href }: ListMenuProps) {
  return (
    <div className="flex flex-col p-4 md:p-8 lg:p-8 items-start"> {/* Responsive padding */}
      <div className="flex items-center gap-4 md:gap-8 lg:gap-16"> {/* Responsive gap */}
        <div className="flex-shrink-0">{icon}</div>
        <Link href={href}>
          <div className="text-white leading-6 md:leading-8 lg:leading-14"> {/* Responsive line height */}
            {description}
          </div>
        </Link>
      </div>
    </div>
  );
}
