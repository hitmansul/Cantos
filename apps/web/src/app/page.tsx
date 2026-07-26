import { HomeCommandCenter } from '@/components/HomeCommandCenter';
import Home from '@/views/Home';

export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6">
        <HomeCommandCenter />
      </div>
      <Home />
    </>
  );
}
