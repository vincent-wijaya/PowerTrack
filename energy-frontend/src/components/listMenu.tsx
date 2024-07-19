import Link from 'next/link';

interface ListMenuProps {
  icon: React.ReactNode;
  description: string;
  href: string; // The URL of the page to navigate to
}

export default function ListMenu({ icon, description, href }: ListMenuProps) {
  return (
    <div className="flex flex-col p-16 items-start">
      <div className="flex items-center gap-16">
        <div className="flex-shrink-0">{icon}</div>
        <Link href={href}>
          <div className="text-white leading-14">{description}</div>
        </Link>
      </div>
    </div>
  );
}
