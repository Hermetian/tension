import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600">The page you&apos;re looking for does not exist.</p>
        <Link 
          href="/" 
          className="text-blue-500 hover:text-blue-600 mt-4 inline-block"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}