import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h2>Not found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <p>
        <Link href="/">Return home</Link>
      </p>
    </div>
  );
}
