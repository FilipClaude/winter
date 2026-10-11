import { lazy, Suspense, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import { useRoute } from './router';
import { TodayScreen } from './screens/today/TodayScreen';
import { Snowfall } from './shell/Snowfall';
import { TabBar } from './shell/TabBar';
import { UpdatePrompt } from './shell/UpdatePrompt';
import { OverlayProvider } from './ui/OverlayProvider';

const TrainingScreen = lazy(() => import('./screens/training/TrainingScreen'));
const SchoolScreen = lazy(() => import('./screens/school/SchoolScreen'));
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'));
const ReviewScreen = lazy(() => import('./screens/review/ReviewScreen'));
const HabitsScreen = lazy(() => import('./screens/habits/HabitsScreen'));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'));

export function App() {
  const route = useRoute();
  const settings = useSettings();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.id]);

  return (
    <OverlayProvider>
      <Snowfall enabled={settings.snow} />
      <UpdatePrompt />
      <main className="app">
        <Suspense fallback={<div className="screen" style={{ minHeight: '100dvh' }} />}>
          {route.id === 'heute' && <TodayScreen date={route.param} />}
          {route.id === 'training' && <TrainingScreen />}
          {route.id === 'schule' && <SchoolScreen />}
          {route.id === 'koerper' && <BodyScreen />}
          {route.id === 'rueckblick' && <ReviewScreen />}
          {route.id === 'habits' && <HabitsScreen />}
          {route.id === 'einstellungen' && <SettingsScreen />}
        </Suspense>
      </main>
      <TabBar active={route.id} />
    </OverlayProvider>
  );
}
