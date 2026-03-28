import { redirect } from 'next/navigation';

type CalenderPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CalenderPage({ searchParams }: CalenderPageProps) {
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item));
      } else if (typeof value === 'string') {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();
  redirect(query ? `/calendar?${query}` : '/calendar');
}
