import Link from 'next/link';

interface ListMenuProps {
  icon: React.ReactNode;
  description: string;
  href: string; // The URL of the page to navigate to
}

export default function ListMenu({ icon, description, href }: ListMenuProps) {
  return (
    <div className="flex flex-col p-4 md:p-8 lg:p-8 items-start group">
      {/* Responsive padding, group added for hover effect */}
      <div className="flex items-center gap-4 md:gap-8 lg:gap-16">
        <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
          {/* Hover scale effect for the icon */}
          {icon}
        </div>
        <Link href={href}>
          <div className="text-white text-sm md:text-base lg:text-lg leading-6 md:leading-8 lg:leading-14 group-hover:font-bold transition-all duration-200">
            {/* Responsive text size: text-sm for small screens, text-base for medium, text-lg for large */}
            {description}
          </div>
        </Link>
      </div>
    </div>
  );
}
